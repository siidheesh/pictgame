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
  getRandInRange,
  serialiseStrokes,
  deserialiseStrokes,
  debug,
} from "./util";

const socket = io("wss://pgapi.siid.sh");

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
        debug,
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
    entry: "connect",
    context: {
      errorMsg: "",
      myPrivateKey: null,
      myPublicKey: null,
      name: "",
      target: "",
      sharedKey: null,
      helloCounter: 20,
      targetKey: null,
      testData: null,
      forky: false,
      level: getRandInRange(0, 2),
      allowLower: true, //Math.random() >= 0.5,
      aliceData: null,
      oppData: null,
      aliceGuess: "",
      bobGuess: "",
      oppDisconnected: false,
      online: false,
      published: false,
    },
    on: {
      CONNECTED: {
        actions: ["sendNameReq"],
      },
      NAME_DECREE: {
        actions: assign({
          online: (_) => true,
          name: (_, event) => event.name,
        }),
      },
      DISCONNECTED: {
        actions: assign({
          online: (_) => false,
          name: (_) => "",
          target: (_) => "",
          oppDisconnected: (_) => true,
        }),
      },
      ...errors,
      DRAWING_CHANGED: {
        actions: assign({
          aliceData: (context, event) => ({
            ...context.aliceData,
            pic: event.pic,
          }),
        }),
      },
    },
    states: {
      init: {
        initial: "generatingKeys",
        onDone: "idle",
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
      idle: {
        id: "idle",
        on: {
          MATCH: "match",
          SINGLEPLAYER: "singlePlayer",
        },
      },
      match: {
        id: "match",
        initial: "waiting",
        on: {
          QUIT: "idle",
        },
        entry: "clearCounter",
        onDone: "game",
        states: {
          checkCounter: {
            always: [
              {
                cond: "matchTimedOut",
                actions: "clearCounter",
                target: "timedOut",
              },
              { target: "waiting" },
            ],
          },
          waiting: {
            entry: ["sendMatchReq", "incrCounter"],
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
            after: [{ delay: "matchWait", target: "checkCounter" }],
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
            after: [{ delay: "matchConfirmation", target: "checkCounter" }],
          },
          timedOut: {
            on: {
              MATCH: "waiting",
              SINGLEPLAYER: "#singlePlayer",
            },
          },
          handshake: {
            initial: "importBobKey",
            after: [{ delay: "handshakeTimeout", target: "checkCounter" }],
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
                      testData: (_) =>
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
                          1000: { target: "sendTest" },
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
        entry: ["informMatched", "clearOppData"],
        exit: ["informUnmatched", "clearOppData"],
        on: {
          QUIT: {
            target: "idle",
            actions: "sendQuit",
          },
          GOTO_MATCH: {
            target: "match",
            actions: "sendQuit",
          },
          INFORM_DISCONNECT: {
            actions: "setOppDisconnected",
            cond: (context, event) => context.target === event.source,
          },
          BOB_QUIT: {
            actions: "setOppDisconnected",
          },
          SINGLEPLAYER: "singlePlayer",
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
                    actions: [
                      "sendPic",
                      assign({ aliceData: (_, event) => event.data }),
                    ],
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
          result: {
            initial: "idle",
            onDone: "round",
            on: {
              INFORM_DISCONNECT: {
                target: ".noRematch",
                cond: (context, event) => context.target === event.source,
              },
              BOB_QUIT: ".noRematch",
            },
            states: {
              idle: {
                on: {
                  REMATCH: { target: "waitForBob", actions: "sendRematchReq" },
                  REMATCH_REQ: "waitForDecision",
                },
              },
              waitForBob: {
                on: {
                  REMATCH_OK: "ready",
                  REMATCH_REQ: "ready",
                  REMATCH_REJECT: "noRematch",
                },
              },
              waitForDecision: {
                on: {
                  REMATCH_OK: { target: "ready", actions: "sendRematchAck" },
                  REMATCH_REJECT: {
                    target: "noRematch",
                    actions: "sendRematchReject",
                  },
                },
              },
              noRematch: {
                entry: "setOppDisconnected",
                on: {
                  QUIT: "#idle", //cant rely on game's QUIT handler as we reset oppDisconnected in game.exit before calling sendQuit
                },
              },
              ready: { type: "final" }, //goto game.round for rematch
            },
          },
        },
      },
      singlePlayer: {
        id: "singlePlayer",
        on: {
          QUIT: "idle",
          PUB_DRAWING: {
            cond: (context) => !context.published,
            actions: ["publishDrawing", assign({ published: (_) => true })],
          },
        },
      },
      error: {},
    },
  },
  {
    delays: {
      matchWait: () => getRandInRange(4000, 5000),
      matchConfirmation: () => getRandInRange(1000, 1500),
      handshakeTimeout: () => getRandInRange(2000, 2500),
    },
    guards: {
      matchTimedOut: (context, _) => context.helloCounter >= 3, // send at most 8 MATCHREQs
    },
    actions: {
      clearCounter: assign({ helloCounter: (_) => 0 }),
      incrCounter: assign({
        helloCounter: (context) => context.helloCounter + 1,
      }),
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
      informMatched: (context, _) => socket.emit("MATCHED", context.target),
      informUnmatched: () => socket.emit("UNMATCHED"),
      sendQuit: (context, _) =>
        socket.emit("DATA", context.target, { type: "BOB_QUIT" }),
      clearOppData: assign({
        oppData: (_) => undefined,
        oppDisconnected: (_) => false,
      }),
      setOppDisconnected: assign({ oppDisconnected: (_) => true }),
      sendPic: (context, event) =>
        encryptObject(context.sharedKey, {
          type: "BOB_DREW",
          pic: serialiseStrokes(event.data.pic),
          label: event.data.label,
        })
          /*.then((iv_enc) => encryptObject(context.sharedKey, iv_enc)) // lol
          .then((iv_enc) => encryptObject(context.sharedKey, iv_enc))
          .then((iv_enc) => encryptObject(context.sharedKey, iv_enc))
          .then((iv_enc) => encryptObject(context.sharedKey, iv_enc))
          .then((iv_enc) => encryptObject(context.sharedKey, iv_enc))*/
          .then((iv_enc) => socket.emit("DATA", context.target, iv_enc)),
      sendGuess: (context, event) =>
        encryptObject(context.sharedKey, {
          type: "BOB_GUESSED",
          guess: event.guess,
        }).then((iv_enc) => socket.emit("DATA", context.target, iv_enc)),
      sendRematchReq: (context, _) =>
        socket.emit("DATA", context.target, { type: "REMATCH?" }),
      sendRematchAck: (context, _) =>
        socket.emit("DATA", context.target, { type: "REMATCH_OK" }),
      sendRematchReject: (context, _) =>
        socket.emit("DATA", context.target, { type: "REMATCH_REJECT" }),
      publishDrawing: (context, _) => {
        if (context.aliceData?.pic) {
          try {
            const pic = serialiseStrokes(context.aliceData.pic);
            socket.emit(
              "PUBLISH",
              JSON.stringify({ ...context.aliceData, pic })
            );
          } catch (e) {
            debug(e);
          }
        }
      },
    },
  }
);

export const mainService = interpret(mainMachine, {
  devTools: true,
})
  .onEvent((event) => debug("event", event))
  /*.onTransition((state) => {
    debug("stateΔ", state.value, state);
  })*/
  .start();

const processData = (source: string, payload: any, wasEncrypted?: boolean) => {
  debug("processData", source, payload);
  if (payload.type) {
    debug(`received a ${payload.type} from ${source}`);
    switch (payload.type) {
      case "MATCHCHECK":
        if (!payload.key) break;
        mainService.send("MATCH_CHECK", {
          source,
          key: payload.key,
        });
        break;
      case "MATCHCHECKACK":
        if (!payload.key) break;
        mainService.send("MATCH_CHECK_ACK", {
          source,
          key: payload.key,
        });
        break;
      case "USER_ACCEPTS":
        mainService.send("BOB_ACCEPTS");
        break;
      case "USER_REJECTS":
      case "USER_TIMEDOUT":
        mainService.send("BOB_REJECTS");
        break;
      case "MATCHTEST":
        if (!payload.iv || !payload.enc) break;
        mainService.send("RECV_TEST", { iv: payload.iv, enc: payload.enc });
        break;
      case "MATCHTEST_REPLY":
        if (!payload.iv || !payload.enc) break;
        mainService.send("RECV_TEST_REPLY", {
          iv: payload.iv,
          enc: payload.enc,
        });
        break;
      case "MATCHTEST_ACK":
        mainService.send("RECV_TEST_PASSED");
        break;
      case "BOB_QUIT":
        mainService.send("BOB_QUIT");
        break;
      case "HEARTBEAT":
        mainService.send("HEARTBEAT");
        break;
      case "BOB_DREW":
        if (!wasEncrypted || !payload.pic || !payload.label) break;
        mainService.send("RECEIVED_PIC", {
          pic: deserialiseStrokes(payload.pic),
          label: payload.label,
        });
        break;
      case "BOB_GUESSED":
        if (!payload.guess) break;
        mainService.send("BOB_GUESSED", { guess: payload.guess });
        break;
      case "REMATCH?":
        mainService.send("REMATCH_REQ");
        break;
      case "REMATCH_OK":
        mainService.send("REMATCH_OK");
        break;
      case "REMATCH_REJECT":
        mainService.send("REMATCH_REJECT");
        break;
      default:
        break;
    }
  } else if (payload.iv && payload.enc && mainService.state.context.sharedKey) {
    debug(`received encrypted DATA from ${source}`);
    decryptObject(
      mainService.state.context.sharedKey,
      payload.iv,
      payload.enc
    ).then((plainobj) => processData(source, plainobj, true));
  }
};

socket.on("connect", () => socket.emit("HELLO"));

socket.on("INIT", () => mainService.send("CONNECTED"));

socket.on("NAME_DECREE", (name: string) => {
  debug("onNAMEDECREE", name);
  mainService.send("NAME_DECREE", { name });
});

socket.on("MATCH_DECREE", (source: string) => {
  debug("onMATCHDECREE", source);
  mainService.send("MATCH_DECREE", { source });
});

socket.on("DATA", (data: any[]) => {
  debug("onDATA", data);
  if (Array.isArray(data)) {
    processData(data[0], data[1]);
  }
});

socket.on("INFORM_DISCONNECT", (source: string) => {
  debug("onINFORM_DISCONNECT", source);
  mainService.send("INFORM_DISCONNECT", { source });
});

socket.on("disconnect", () => {
  mainService.send("DISCONNECTED");
});
