import { io } from "socket.io-client";
import { Machine, assign, actions, send, interpret, createMachine } from "xstate";
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

const socket = io("wss://api.siidhee.sh", { autoConnect: false });

const errors = [
  "ERR_GEN_KEYS",
  "ERR_EXPORT_KEYS",
  "ERR_IMPORT_SHARED_KEY",
  "ERR_GEN_SHARED_KEY",
  "ERR_SEND_TEST",
  "ERR_CHECK_TEST",
  "ERR_REPLY_TEST",
].reduce((acc: any, evt) => {
  acc[evt /*.replace("ERR_","error.").toLowerCase()*/] = "error";
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
    },
    on: {
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
        entry: ["connect"],
        on: {
          CONNECTED: {
            target: "idle",
            actions: assign({
              id: (_, event) => event.data,
            }),
          },
        },
      },
      idle: {
        on: {
          MATCH: "match",
        },
      },
      match: {
        id: "match",
        initial: "sayHello",
        on: {
          QUIT: "idle",
        },
        onDone: "game",
        entry: (context) => (context.helloCounter = 20),
        states: {
          sayHello: {
            entry: ["hello", (context) => context.helloCounter--],
            on: {
              "": [
                { target: "#main.idle", cond: (context) => context.helloCounter <= 0 }
              ],
              RECV_HELLO: {
                target: "receivedHello",
                actions: assign({ target: (_, event) => event.source }),
              },
              RECV_REQ: {
                target: "acceptance",
                actions: [
                  assign({
                    target: (_, event) => event.source,
                    targetKey: (_, event) => event.key,
                    forky: (_) => true,
                  }),
                  "sendMatchReqAck",
                ],
              },
              HELLO_TIMEOUT: "#main.idle",
            },
            after: {
              1000: [
                {
                  target: "sayHello",
                  cond: (context) => context.helloCounter > 0,
                },
                { actions: send("HELLO_TIMEOUT") },
              ],
            },
          },
          receivedHello: {
            // we can decide here if we want to respond to a HELLO. for now we'll accept all of em
            //entry: "sendMatchReq",
            on: {
              RECV_RESP: {
                target: "acceptance",
                actions: assign({
                  targetKey: (_, event) => event.key,
                  forky: (_) => false,
                }),
              },
            },
            after: [
              {
                delay: () => getRandInRange(0, 100),
                actions: "sendMatchReq"
              },
              {
                target: "sayHello", // TIMEOUT
                delay: () => getRandInRange(500, 800),
              },
            ],
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
              HANDSHAKE_TIMEOUT: "sayHello",
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
                  1000: { actions: send("HANDSHAKE_TIMEOUT") },
                },
                states: {
                  fork: {
                    on: {
                      "": [
                        {
                          target: "aliceTest",
                          cond: (context, _) => context.forky,
                        },
                        {
                          target: "bobTest",
                          cond: (context, _) => !context.forky,
                        },
                      ],
                    },
                  },
                  aliceTest: {
                    initial: "sendTest",
                    states: {
                      sendTest: {
                        entry: assign({
                          testData: (context, event) =>
                            window.crypto.getRandomValues(new Uint8Array(10)),
                        }),
                        on: {
                          RECV_TEST_REPLY: "checkTest",
                        },
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
                actions: cancel("hbTimer"),
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
    actions: {
      connect: () => socket.connect(),
      hello: (context, _) => socket.emit("HELLO", {}),
      sendMatchReq: (context, _) =>
        socket.emit("DATA", context.target, {
          type: "MATCHREQ",
          key: context.myPublicKey,
        }),
      sendMatchReqAck: (context, _) =>
        socket.emit("DATA", context.target, {
          type: "MATCHREQ_ACK",
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
  .onEvent((event) => console.log("event", event))
  /*.onTransition((state) => {
    console.log("stateΔ", state.value, state);
  })*/
  .start();

socket.on("INIT", (data: string) => mainService.send("CONNECTED", { data }));

socket.on("HELLO", (data: any[]) => {
  console.log("onHELLO", data);
  const source = data[0];
  //payload = data[1];
  mainService.send("RECV_HELLO", { source });
});

socket.on("DATA", (data: any[]) => {
  console.log("onDATA", data);
  if (Array.isArray(data)) {
    const source = data[0],
      payload = data[1];
    if (typeof payload === "object" && payload.type) {
      switch (payload.type) {
        case "MATCHREQ":
          if (!payload.key) break;
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("RECV_REQ", {
            source,
            key: _base64ToArrayBuffer(payload.key),
          });
          break;
        case "MATCHREQ_ACK":
          console.log(`received a ${payload.type} from ${source}`);
          mainService.send("RECV_RESP", {
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

const match = Machine({

});

socket.on("DATA", console.log);

socket.on("disconnect", () => {
  mainService.send("DISCONNECT");
});

export const onEvent = (target: string) => (event: any) => {
  console.log("onEvent invoked", target, event);
  socket.emit("DATA", target, { type: "GAME", event });
};
