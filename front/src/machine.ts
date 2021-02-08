import { io } from "socket.io-client";
import { assign, send, interpret, createMachine } from "xstate";
import {
  generateKeyPair,
  exportRawKey,
  importBobKey,
  generateSharedKey,
  encryptTest,
  checkTest,
  replyTest,
  encryptObject,
  decryptObject,
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
  // errorType, errorMessage, isRecoverable
  ["ERR_GEN_KEYS", "Failed to generate encryption keys", false],
  ["ERR_EXPORT_KEYS", "Failed to process encryption keys", false],
  ["ERR_IMPORT_SHARED_KEY", "Failed to process shared key", true],
  ["ERR_GEN_SHARED_KEY", "Failed to generate shared key", true],
  ["ERR_SEND_TEST", "Matchmaking failed", true],
  ["ERR_CHECK_TEST", "Matchmaking failed", true],
  ["ERR_REPLY_TEST", "Matchmaking failed", true],
].reduce(
  (acc: any, [errorType, errorMessage, isRecoverable]: any) => ({
    ...acc,
    [errorType]: {
      ...(!isRecoverable && { target: "error" }), // transit to error if !isRecoverable
      actions: [
        console.log,
        assign({
          errorMsg: !isRecoverable ? errorMessage : `Error type '${errorType}'`,
        }),
      ],
    },
  }),
  {}
);

const mainMachine = createMachine<MainContext>(
  {
    id: "main",
    strict: true,
    initial: "init",
    context: {
      errorMsg: "",
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
            initial: "importBobKey",
            on: {
              HANDSHAKE_TIMEOUT: "waiting",
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
                    entry: assign({
                      testData: (context, event) =>
                        window.crypto.getRandomValues(new Uint8Array(10)),
                    }),
                    states: {
                      sendTest: {
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
              TIMEOUT: {
                target: "#match",
                actions: "sendTimedOut",
              },
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
      sendTimedOut: (context, _) =>
        socket.emit("DATA", context.target, { type: "USER_TIMEDOUT" }),
      sendTest: (context, event) =>
        socket.emit("DATA", context.target, {
          //TOD: use username instead of random testData
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
        encryptObject(context.sharedKey, {
          type: "SUBMIT_PIC",
          pic: serialiseStrokes(event.data),
          label: `${context.name}'s picture`,
        }).then((iv_enc) => socket.emit("DATA", context.target, iv_enc)),
      sendGuess: (context, event) =>
        encryptObject(context.sharedKey, {
          type: "BOB_GUESSED",
          guess: event.guess,
        }).then((iv_enc) => socket.emit("DATA", context.target, iv_enc)),
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

const processData = (source: string, payload: any, wasEncrypted?: boolean) => {
  if (payload.type) {
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
      case "USER_TIMEDOUT":
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
        if (!wasEncrypted || !payload.pic || !payload.label) break;
        console.log(`received a ${payload.type} from ${source}`);
        mainService.send("RECEIVED_PIC", {
          pic: deserialiseStrokes(payload.pic),
          label: payload.label,
        });
        break;
      case "BOB_GUESSED":
        if (!payload.guess) break;
        mainService.send("BOB_GUESSED", { guess: payload.guess });
        break;
      default:
        break;
    }
  } else if (payload.iv && payload.enc && mainService.state.context.sharedKey) {
    console.log(`received encrypted DATA from ${source}`);
    decryptObject(
      mainService.state.context.sharedKey,
      payload.iv,
      payload.enc
    ).then((plainobj) => processData(source, plainobj, true));
  }
};

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
    processData(data[0], data[1]);
  }
});

socket.on("disconnect", () => {
  mainService.send("DISCONNECT");
});

export const onEvent = (target: string) => (event: any) => {
  console.log("onEvent invoked", target, event);
  socket.emit("DATA", target, { type: "GAME", event });
};
