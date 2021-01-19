import { rejects } from "assert";
import { Machine, assign, send, sendParent, actions } from "xstate";
import {
  MainContext,
  _arrayBufferToBase64,
  _base64ToArrayBuffer,
  ecdhDevParams,
  aesParams,
} from "./util";
const { escalate } = actions;

export const importBobKey = (context: MainContext, event: any) =>
  window.crypto.subtle.importKey(
    "raw",
    context.targetKey,
    ecdhDevParams,
    true,
    []
  );

export const generateSharedKey = (context: MainContext, event: any) =>
  window.crypto.subtle.deriveKey(
    { name: ecdhDevParams.name, public: event.data }, //event.data is bob's imported key from importBobKey
    context.myPrivateKey,
    aesParams as AesDerivedKeyParams,
    false,
    ["encrypt", "decrypt"]
  );

export const encryptTest = (context: any) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(96));
  return window.crypto.subtle
    .encrypt(
      { ...aesParams, iv }, // TODO: use sequence num as auth tag
      context.sharedKey,
      context.testData
    )
    .then((encres) => [iv, encres]);
};

const handleTest = (context: MainContext, event: any) =>
  window.crypto.subtle
    .decrypt(
      { ...aesParams, iv: _base64ToArrayBuffer(event.iv) },
      context.sharedKey,
      _base64ToArrayBuffer(event.enc)
    )
    .then((testData) => new Uint8Array(testData).map((el) => 255 - el));

export const checkTest = (context: MainContext, event: any) =>
  handleTest(context, event).then((resData) => {
    if (
      _arrayBufferToBase64(resData) !== _arrayBufferToBase64(context.testData)
    )
      {
        console.log("checkTest FAILED!",context.testData,resData);
        return Promise.reject(new Error());
      }
  });

export const replyTest = (context: MainContext, event: any) =>
  handleTest(context, event).then((resData) =>
    encryptTest({ sharedKey: context.sharedKey, testData: resData })
  );

const acceptanceMachine = Machine({
  id: "acceptance",
  initial: "aliceDecision",
  strict: true,
  on: {
    TIMEOUT: "rejected",
    BOB_REJECT: "rejected",
  },
  states: {
    aliceDecision: {
      on: {
        ACCEPT: {
          target: "bobDecision",
        },
        REJECT: {
          target: "rejected",
        },
      },
    },
    bobDecision: {
      on: {
        ACCEPT: {
          target: "accepted",
        },
      },
    },
    accepted: {
      type: "final",
    },
    rejected: {
      entry: sendParent("REJECTED"),
    },
  },
});

const recvReqHandshakeMachine = Machine({});

const recvHelloHandshakeMachine = Machine({});

/*
export const matchMachine = Machine<MatchContext>(
    {
        id: "match",
        strict: true,
        initial: "sayHello",
        context: {
            helloCounter: 10,
            myId: "",
            myPrivateKey: undefined,
            myPublicKey: undefined,
            bobRawKey: undefined,
            sharedKey: undefined,
            testData: undefined,
            target: "",
        },
        states: {
            sayHello: {
                entry: ["hello"],
                on: {
                    RECV_HELLO: {
                        target: "receivedHello",
                        actions: assign({
                            target: (_, event) => event.target,
                            bobRawKey: (_, event) => event.bobRawKey,
                        })
                    },
                    RECV_REQ: {
                        target: "receivedRequest",
                        actions: assign({
                            target: (_, event) => event.target,
                            bobRawKey: (_, event) => event.bobRawKey,
                        }),
                    }
                },
                after: {
                    1000: {
                        target: "sayHello",
                        cond: (context, _) => context.helloCounter >= 1,
                    },
                    1001: {
                        actions: escalate("HELLO_TIMEOUT"),
                    },
                },
            },
            receivedHello: {
                initial: "acceptance",
                states: {
                    acceptance: {
                        invoke: {
                            src: acceptanceMachine,
                            onDone: "handshake",
                            onError: {
                                actions: escalate("HELLO_ACCEPTANCE_ERR"),
                            }
                        }
                    },
                    handshake: {
                        invoke: {
                            src: recvHelloHandshakeMachine,
                            onError: {
                                actions: escalate("HELLO_HANDSHAKE_ERR"),
                            }
                        }
                    }
                }
            },
            receivedRequest: {
                initial: "acceptance",
                on: {
                    REJECTED: "sayHello",
                },
                states: {
                    acceptance: {
                        invoke: {
                            src: acceptanceMachine,
                            onDone: "handshake",
                            onError: {
                                actions: escalate("REQ_ACCEPTANCE_ERR"),
                            }
                        }
                    },
                    handshake: {
                        invoke: {
                            src: recvReqHandshakeMachine,
                            onError: {
                                actions: escalate("REQ_HANDSHAKE_ERR"),
                            }
                        }
                    }
                }
            },
            error: {
                //entry: sendParent("MATCH_ERROR")
            }
        }
    });
*/

/*
            _receivedRequest: {
                initial: "waitingForDecision",
                on: {
                    RESET: "idle",
                    DISCONNECT: "waitForSocket",
                },
                states: {
                    waitingForDecision: {
                        on: {
                            ACCEPT: {
                                target: "handshake",
                                actions: ["sendPubKey"],
                            },
                            REJECT: {
                                target: "rejected",
                                actions: ["resetHelloCounter"],
                            },
                        }
                    },
                    handshake: {
                        initial: "importBobKey",
                        states: {
                            importBobKey: {
                                invoke: {
                                    id: "importBobKey",
                                    src: importBobKey,
                                    onDone: "generateSharedKey",
                                    onError: {
                                        target: "error",
                                        actions: ["error"],
                                    },
                                },
                            },
                            generateSharedKey: {
                                invoke: {
                                    id: "generateSharedKey",
                                    src: generateSharedKey,
                                    onDone: {
                                        target: "encryptTest",
                                        actions: assign({
                                            sharedKey: (_, event) => event.data,
                                        }),
                                    },
                                    onError: {
                                        target: "error",
                                        actions: ["error"],
                                    },
                                },
                            },
                            encryptTest: {
                                entry: assign({
                                    testData: (context, event) =>
                                        window.crypto.getRandomValues(
                                            new Uint8Array(10)
                                        ),
                                }),
                                invoke: {
                                    id: "encryptTest",
                                    src: encryptTest,
                                    onDone: {
                                        actions: ["sendTest"],
                                    },
                                    onError: {
                                        target: "error",
                                        actions: ["error"],
                                    },
                                },
                            },
                            checkTest: {
                                invoke: {
                                    id: "checkTest",
                                    src: checkTest,
                                    onDone: "ready",
                                    onError: {
                                        target: "error",
                                        actions: ["error"],
                                    },
                                },
                            },
                            ready: {
                                type: "final",
                            },
                            error: {},
                        },
                        onDone: "matched"
                    },
                    rejected: {
                        type: "final"
                    },
                    matched: {
                        type: "final"
                    }
                },
                onDone: "matched"
            },
            matched: {
                on: {
                    RESET: "idle",
                    DISCONNECT: "waitForSocket",
                },
            },
        },
    },
    {
        actions: {
            // action implementations
            error: (context, event) => {
                console.log(event);
            },
            hello: (context, event) => {
                context.helloCounter--;
                console.log("saying hello...");
                socket.emit("HELLO", {});
            },
            resetHelloCounter: (context, event) => {
                console.log("resetting helloCounter!");
                context.helloCounter = 10;
            },
            sendPubKey: (context, event) => {
                console.log(
                    `sending MATCHOK to ${context.target} key: `,
                    context.myPublicKey
                );
                socket.emit("DATA", context.target, {
                    type: "MATCHOK",
                    key: _arrayBufferToBase64(context.myPublicKey),
                });
            },
            sendTest: (context, event) => {
                console.log(
                    `sending MATCHTEST to ${context.target} data: `,
                    event.data
                );
                socket.emit("DATA", context.target, {
                    type: "MATCHTEST",
                    iv: _arrayBufferToBase64(event.data[0]),
                    enc: _arrayBufferToBase64(event.data[1]),
                });
            },
        },
    }
);*/
