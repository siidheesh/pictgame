import { io } from "socket.io-client";
import { assign, send, interpret, createMachine, Machine } from "xstate";
import {
  generateKeyPair,
  exportRawKey,
  importBobKey,
  generateSharedKey,
  encryptTest,
  checkTest,
  replyTest,
  encrypt,
  decrypt,
} from "./crypto";
import {
  MainContext,
  _base64ToArrayBuffer,
  getRandInRange,
  serialiseStrokes,
  deserialiseStrokes,
} from "./util";

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

const promiseMachine = Machine({
  id: "promise",
  initial: "pending",
  states: {
    pending: {},
    resolved: {},
    rejected: {},
  },
});

const mainMachine = createMachine<MainContext>(
  {
    id: "main",
    strict: true,
    initial: "init",
    context: {
      myPrivateKey: undefined,
      myPublicKey: undefined,
      name: "",
      target: "",
      sharedKey: undefined,
      helloCounter: 20,
      targetKey: undefined,
      testData: undefined,
      forky: false,
      level: getRandInRange(0, 2),
      allowLower: true, //Math.random() >= 0.5,
      oppData: undefined,
      aliceGuess: "",
      bobGuess: "",
    },
    on: {
      DISCONNECT: [
        {
          target: "init",
          //cond: (context, _) => context.myPrivateKey && context.myPublicKey,
        },
      ],
      ...errors,
    },
    invoke: {
      // accessible via state.children.pm
      id: "pm",
      src: promiseMachine,
    },
    states: {
      init: {
        type: "parallel",
        onDone: "idle",
        states: {
          prepareKeys: {
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
                    actions: [send("ERR_GEN_KEYS"), "alertUser"],
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
              ready: { type: "final" },
            },
          },
          prepareSocket: {
            initial: "disconnected",
            states: {
              disconnected: {
                on: {
                  CONNECTED: "waitForName",
                },
                always: [
                  {
                    cond: (_) => socket.connected,
                    target: "waitForName",
                  },
                ],
                after: {
                  500: { target: "disconnected", actions: "connect" },
                },
              },
              waitForName: {
                entry: "sendNameReq",
                on: {
                  NAME_DECREE: {
                    target: "ready",
                    actions: assign({
                      name: (_, event) => event.name,
                    }),
                  },
                },
                after: {
                  1000: { target: "waitForName" },
                },
              },
              ready: { type: "final" },
            },
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
                target: "handshake",
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
                target: "handshake",
                cond: (context, event) => event.source === context.target,
                actions: assign({
                  targetKey: (_, event) => event.key,
                  forky: (_) => false,
                }),
              },
            },
            after: [{ delay: "matchConfirmation", target: "waiting" }],
          },
          handshake: {
            // either a MATCHREQ response to our HELLO or MATCHREQ_ACK response to our MATCHREQ response to someone's HELLO
            initial: "importBobKey",
            on: {
              HANDSHAKE_TIMEOUT: "",
            },
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
                            target: "#match.acceptance",
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
                          RECV_TEST_PASSED: "#match.acceptance",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          acceptance: {
            id: "acceptance",
            type: "parallel",
            onDone: "matched",
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
          matched: { type: "final" },
        },
      },
      game: {
        id: "game",
        initial: "round",
        entry: "clearOppData",
        exit: "clearOppData",
        on: {
          QUIT: {
            target: "idle",
            actions: "sendQuit",
          },
        },
        states: {
          round: {
            type: "parallel",
            onDone: "guessing",
            states: {
              alice: {
                initial: "drawing",
                on: {
                  SUBMIT_PIC: {
                    target: ".ready",
                    actions: "sendPic",
                  },
                },
                states: {
                  drawing: {},
                  ready: { type: "final" },
                },
              },
              bob: {
                initial: "drawing",
                on: {
                  RECEIVED_PIC: {
                    target: ".ready",
                    actions: assign({
                      oppData: (_, event) => ({
                        pic: event.pic,
                        label: event.label,
                      }),
                    }),
                  },
                },
                states: {
                  drawing: {},
                  ready: { type: "final" },
                },
              },
            },
          },
          guessing: {
            type: "parallel",
            onDone: "result",
            states: {
              alice: {
                initial: "waiting",
                states: {
                  waiting: {
                    on: {
                      ALICE_GUESSED: {
                        target: "ready",
                        actions: [
                          assign({ aliceGuess: (_, event) => event.guess }),
                          "sendGuess",
                        ],
                      },
                    },
                  },
                  ready: { type: "final" },
                },
              },
              bob: {
                initial: "waiting",
                states: {
                  waiting: {
                    on: {
                      BOB_GUESSED: {
                        target: "ready",
                        actions: assign({
                          bobGuess: (_, event) => event.guess,
                        }),
                      },
                    },
                  },
                  ready: { type: "final" },
                },
              },
            },
          },
          result: {},
        },
      },
      /*game: {
        type: "parallel",
        states: {
          alice: {
            states: {
              drawing: {
                on: {
                  SUBMIT_PIC: {
                    target: "waitForBob",
                    actions: "sendPic",
                  },
                },
              },
              waitForBob: {},
              guessing: {},
              fin: { type: "final" },
            },
          },
          bob: {
            states: {
              drawing: {
                on: {
                  RECEIVED_PIC: {
                    target: "fin",
                    actions: assign({
                      oppData: (_, event) => ({
                        pic: event.pic,
                        label: event.label,
                      }),
                    }),
                  },
                },
              },
              guessing: {}, // in future, maybe request correct answer from bob at this point, instead of sending label tgt with pic
              fin: { type: "final" },
            },
          },
        },
      },*/
      error: {},
    },
  },
  {
    delays: {
      matchWait: () => getRandInRange(1500, 2000),
      matchConfirmation: () => getRandInRange(800, 1000),
    },
    actions: {
      alertUser: () => alert("error!"),
      connect: () => socket.connect(),
      sendNameReq: () => socket.emit("NAME_REQUEST"),
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
          iv: event.data.iv,
          enc: event.data.enc,
        }),
      sendTestReply: (context, event) =>
        socket.emit("DATA", context.target, {
          type: "MATCHTEST_REPLY",
          iv: event.data.iv,
          enc: event.data.enc,
        }),
      sendTestAck: (context, _) =>
        socket.emit("DATA", context.target, { type: "MATCHTEST_ACK" }),
      sendHeartBeat: (context, _) =>
        socket.emit("DATA", context.target, { type: "HEARTBEAT" }),
      sendQuit: (context, _) =>
        socket.emit("DATA", context.target, { type: "USER_QUIT" }),
      clearOppData: assign({ oppData: (_) => undefined }),
      sendPic: (context, event) =>
        encrypt(
          context.sharedKey,
          new TextEncoder().encode(
            JSON.stringify({
              pic: serialiseStrokes(event.data),
              label: `${context.name}'s picture`,
            })
          )
        ).then(({ iv, enc }) => {
          socket.emit("DATA", context.target, {
            type: event.type,
            iv,
            enc,
          });
        }),
      sendGuess: (context, event) =>
        socket.emit("DATA", context.target, {
          type: "BOB_GUESSED",
          guess: event.guess,
        }),
    },
  }
);

export const mainService = interpret(mainMachine, {
  devTools: true,
})
  /*.onEvent((event) => console.log("event", event))
  .onTransition((state) => {
    console.log("stateΔ", state.value, state);
  })*/
  .start();

socket.on("INIT", () => mainService.send("CONNECTED"));

socket.on("NAME_DECREE", (name: string) => {
  console.log("onNAMEDECREE", name);
  mainService.send("NAME_DECREE", { name });
});

socket.on("MATCH_DECREE", (source: string) => {
  console.log("onMATCHDECREE", source);
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
        case "SUBMIT_PIC":
          if (!payload.iv || !payload.enc) break;
          mainService.state.context.sharedKey &&
            decrypt(
              mainService.state.context.sharedKey,
              payload.iv,
              payload.enc
            ).then((plaindata) => {
              const plainobj = JSON.parse(new TextDecoder().decode(plaindata));
              mainService.send("RECEIVED_PIC", {
                pic: deserialiseStrokes(plainobj.pic),
                label: plainobj.label,
              });
            });
          break;
        case "BOB_GUESSED":
          if (!payload.guess) break;
          mainService.send("BOB_GUESSED", { guess: payload.guess });
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
