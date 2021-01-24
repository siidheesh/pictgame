import { io } from "socket.io-client";
import { assign, actions, send, interpret, createMachine } from "xstate";
import { generateKeyPair, exportRawKey } from "./initMachine";
import {
  importBobKey,
  generateSharedKey,
  encryptTest,
  checkTest,
  replyTest,
} from "./matchMachine";
import {
  MainContext,
  _base64ToArrayBuffer,
  getRandInRange,
  _arrayBufferToBase64,
} from "./util";

const { cancel } = actions;

const socket = io("wss://api.siidhee.sh");

const errors = [
  "ERR_GEN_KEYS",
  "ERR_EXPORT_KEYS",
  "ERR_IMPORT_SHARED_KEY",
  "ERR_GEN_SHARED_KEY",
  "ERR_SEND_TEST",
  "ERR_CHECK_TEST",
  "ERR_REPLY_TEST",
].reduce((acc: any, evt) => {
  acc[evt /*.replace("ERR_","error.").toLowerCase()*/] = {
    target: "error",
    actions: console.log,
  };
  return acc;
}, {});

/*
const generateKeyPair = exportRawKey = importBobKey = generateSharedKey = encryptTest = replyTest = checkTest = (
    context
) =>
    new Promise((resolve, reject) => {
        setTimeout(
            () =>
                Math.random() >= 0
                    ? resolve({})
                    : reject(new Error("key processing failed")),
            500
        );
    });
*/

const mainMachine = createMachine<MainContext>(
  {
    id: "main",
    strict: true,
    initial: "init",
    context: {
      myPrivateKey: undefined,
      myPublicKey: undefined,
      id: "",
      target: "",
      sharedKey: undefined,
      helloCounter: 20,
      targetKey: undefined,
      testData: undefined,
      forky: false,
      level: getRandInRange(0, 2),
      allowLower: Math.random() >= 0.5,
    },
    on: {
      CONNECTED: {
        actions: assign({
          id: (_, event) => event.data,
        }),
      },
      DISCONNECT: [
        {
          target: "disconnected",
          cond: (context, _) => context.myPrivateKey && context.myPublicKey,
        },
      ],
      ...errors,
    },
    states: {
      init: {
        initial: "generatingKeys",
        states: {
          generatingKeys: {
            invoke: {
              id: "generateKeyPair",
              src: generateKeyPair,
              onDone: {
                target: "exportRawKey",
                actions: assign({
                  myPrivateKey: (_, event) => event.data.privateKey,
                }),
              },
              onError: {
                actions: send("ERR_GEN_KEYS"),
              },
            },
          },
          exportRawKey: {
            invoke: {
              id: "exportRawKey",
              src: exportRawKey,
              onDone: {
                target: "ready",
                actions: assign({
                  myPublicKey: (_, event) => event.data,
                }),
              },
              onError: {
                actions: send("ERR_EXPORT_KEYS"),
              },
            },
          },
          ready: {
            type: "final",
          },
        },
        onDone: "disconnected",
      },
      disconnected: {
        always: [
          {
            cond: (_) => socket.connected,
            target: "idle",
          },
        ],
        after: {
          500: { target: "disconnected", actions: "connect" },
        },
      },
      idle: {
        on: {
          MATCH: "match",
        },
      },
      match: {
        id: "match",
        initial: "waiting",
        on: {
          QUIT: "idle",
        },
        onDone: "game",
        states: {
          waiting: {
            entry: "sendMatchReq",
            on: {
              MATCH_CHECK: {
                target: "acceptance",
                actions: [
                  "sendMatchCheckAck",
                  assign({
                    target: (_, event) => event.source,
                    targetKey: (_, event) => event.key,
                    forky: (_) => true,
                  }),
                ],
              },
              MATCH_DECREE: {
                target: "waitForConfirmation",
                actions: [
                  "sendMatchCheck",
                  assign({ target: (_, event) => event.source }),
                ],
              },
            },
            after: [{ delay: "matchWait", target: "waiting" }],
          },
          waitForConfirmation: {
            on: {
              MATCH_CHECK_ACK: {
                target: "acceptance",
                cond: (context, event) => event.source === context.target,
                actions: assign({
                  targetKey: (_, event) => event.key,
                  forky: (_) => false,
                }),
              },
            },
            after: [{ delay: "matchConfirmation", target: "waiting" }],
          },
          acceptance: {
            id: "acceptance",
            type: "parallel",
            onDone: "handshake",
            on: {
              TIMEOUT: "#match",
            },
            states: {
              alice: {
                initial: "wait",
                states: {
                  wait: {
                    on: {
                      ALICE_ACCEPTS: {
                        target: "ready",
                        actions: "sendAcceptance",
                      },
                      ALICE_REJECTS: {
                        target: "#match",
                        actions: "sendRejection",
                      },
                    },
                  },
                  ready: { type: "final" },
                },
              },
              bob: {
                initial: "wait",
                states: {
                  wait: {
                    on: {
                      BOB_ACCEPTS: "ready",
                      BOB_REJECTS: "#match",
                    },
                  },
                  ready: { type: "final" },
                },
              },
            },
          },
          handshake: {
            // either a MATCHREQ response to our HELLO or MATCHREQ_ACK response to our MATCHREQ response to someone's HELLO
            initial: "importBobKey",
            on: {
              HANDSHAKE_TIMEOUT: "",
            },
            onDone: "matched",
            states: {
              importBobKey: {
                invoke: {
                  id: "importBobKey",
                  src: importBobKey,
                  onDone: "generateSharedKey",
                  onError: {
                    actions: send("ERR_IMPORT_SHARED_KEY"),
                  },
                },
              },
              generateSharedKey: {
                invoke: {
                  id: "generateSharedKey",
                  src: generateSharedKey,
                  onDone: {
                    target: "testConnection",
                    actions: assign({
                      sharedKey: (_, event) => event.data,
                    }),
                  },
                  onError: {
                    actions: send("ERR_GEN_SHARED_KEY"),
                  },
                },
              },
              testConnection: {
                initial: "fork",
                after: {
                  2000: { actions: send("HANDSHAKE_TIMEOUT") },
                },
                states: {
                  fork: {
                    always: [
                      {
                        target: "bobTest",
                        cond: (context, _) => !context.forky,
                      },
                      {
                        target: "aliceTest",
                        cond: (context, _) => context.forky,
                      },
                    ],
                  },
                  aliceTest: {
                    initial: "sendTest",
                    on: {
                      RECV_TEST_REPLY: ".checkTest",
                    },
                    entry: assign({
                      testData: (context, event) =>
                        window.crypto.getRandomValues(new Uint8Array(10)),
                    }),
                    states: {
                      sendTest: {
                        invoke: {
                          id: "encryptTest",
                          src: encryptTest,
                          onDone: {
                            actions: ["sendTest"],
                          },
                          onError: {
                            actions: send("ERR_SEND_TEST"),
                          },
                        },
                        after: {
                          500: { target: "sendTest" },
                        },
                      },
                      checkTest: {
                        invoke: {
                          id: "checkTest",
                          src: checkTest,
                          onDone: {
                            target: "#match.matched",
                            actions: ["sendTestAck"],
                          },
                          onError: {
                            actions: send("ERR_CHECK_TEST"),
                          },
                        },
                      },
                    },
                  },
                  bobTest: {
                    initial: "waitForTest",
                    states: {
                      waitForTest: {
                        on: {
                          RECV_TEST: "replyTest",
                        },
                      },
                      replyTest: {
                        invoke: {
                          id: "replyTest",
                          src: replyTest,
                          onDone: {
                            target: "waitForAck",
                            actions: ["sendTestReply"],
                          },
                          onError: {
                            actions: send("ERR_REPLY_TEST"),
                          },
                        },
                      },
                      waitForAck: {
                        on: {
                          RECV_TEST_PASSED: "#match.matched",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          matched: { type: "final" },
        },
      },
      game: {
        type: "parallel",
        on: {
          QUIT: {
            target: "idle",
            actions: "sendQuit",
          },
        },
        states: {
          heartbeat: {
            initial: "fork",
            on: {
              HEARTBEAT: {
                //actions: cancel("hbTimer"),
              },
            },
            states: {
              fork: {
                on: {
                  "": [
                    { target: "lub", cond: (context, _) => context.forky },
                    { target: "dub", cond: (context, _) => !context.forky },
                  ],
                },
              },
              lub: {
                //entry: "sendHeartBeat",
                after: {
                  //1000: "dub",
                },
              },
              dub: {
                after: {
                  //1000: "lub",
                },
              },
            },
          },
          main: {},
        },
      },
      error: {},
    },
  },
  {
    delays: {
      matchWait: () => getRandInRange(800, 1000),
      matchConfirmation: () => getRandInRange(300, 500),
    },
    actions: {
      connect: () => socket.connect(),
      sendMatchReq: (context) =>
        socket.emit("MATCHREQ", {
          level: context.level,
          allowLower: context.allowLower,
        }),
      sendMatchCheck: (context) =>
        socket.emit("DATA", context.target, {
          type: "MATCHCHECK",
          key: context.myPublicKey,
        }),
      sendMatchCheckAck: (context) =>
        socket.emit("DATA", context.target, {
          type: "MATCHCHECKACK",
          key: context.myPublicKey,
        }),
      sendAcceptance: (context, _) =>
        socket.emit("DATA", context.target, { type: "USER_ACCEPTS" }),
      sendRejection: (context, _) =>
        socket.emit("DATA", context.target, { type: "USER_REJECTS" }),
      sendTest: (context, event) =>
        socket.emit("DATA", context.target, {
          type: "MATCHTEST",
          iv: _arrayBufferToBase64(event.data[0]),
          enc: _arrayBufferToBase64(event.data[1]),
        }),
      sendTestReply: (context, event) =>
        socket.emit("DATA", context.target, {
          type: "MATCHTEST_REPLY",
          iv: _arrayBufferToBase64(event.data[0]),
          enc: _arrayBufferToBase64(event.data[1]),
        }),
      sendTestAck: (context, _) =>
        socket.emit("DATA", context.target, { type: "MATCHTEST_ACK" }),
      sendHeartBeat: (context, _) =>
        socket.emit("DATA", context.target, { type: "HEARTBEAT" }),
      sendQuit: (context, _) =>
        socket.emit("DATA", context.target, { type: "USER_QUIT" }),
    },
  }
);

export const mainService = interpret(mainMachine, {
  devTools: true,
})
  //.onEvent((event) => console.log("event", event))
  /*.onTransition((state) => {
    console.log("stateΔ", state.value, state);
  })*/
  .start();

socket.on("INIT", (data: string) => mainService.send("CONNECTED", { data }));

socket.on("MATCH_DECREE", (source: string) => {
  console.log("onDECREE", source);
  mainService.send("MATCH_DECREE", { source });
});

socket.on("DATA", (data: any[]) => {
  console.log("onDATA", data);
  if (Array.isArray(data)) {
    const source = data[0],
      payload = data[1];
    if (typeof payload === "object" && payload.type) {
      switch (payload.type) {
        case "MATCHCHECK":
          if (!payload.key) break;
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("MATCH_CHECK", {
            source,
            key: _base64ToArrayBuffer(payload.key),
          });
          break;
        case "MATCHCHECKACK":
          if (!payload.key) break;
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("MATCH_CHECK_ACK", {
            source,
            key: _base64ToArrayBuffer(payload.key),
          });
          break;
        case "USER_ACCEPTS":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("BOB_ACCEPTS");
          break;
        case "USER_REJECTS":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("BOB_REJECTS");
          break;
        case "MATCHTEST":
          if (!payload.iv || !payload.enc) break;
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("RECV_TEST", { iv: payload.iv, enc: payload.enc });
          break;
        case "MATCHTEST_REPLY":
          if (!payload.iv || !payload.enc) break;
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("RECV_TEST_REPLY", {
            iv: payload.iv,
            enc: payload.enc,
          });
          break;
        case "MATCHTEST_ACK":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("RECV_TEST_PASSED");
          break;
        case "USER_QUIT":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("QUIT");
          break;
        case "HEARTBEAT":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("HEARTBEAT");
          break;
        case "GAME":
          if (!payload.event) break;
          console.log(`received a ${payload.type} from ${source}`);
          break;
        default:
          break;
      }
    }
  }
});

socket.on("disconnect", () => {
  mainService.send("DISCONNECT");
});

export const onEvent = (target: string) => (event: any) => {
  console.log("onEvent invoked", target, event);
  socket.emit("DATA", target, { type: "GAME", event });
};
