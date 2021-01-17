import { Button } from "@material-ui/core";
import { useService } from "@xstate/react";
//import React, { useState, useRef, useEffect } from "react";

//import { matchMachine } from "./logic";
import { Machine, interpret, assign, send } from "xstate";
import { io } from "socket.io-client";

function _arrayBufferToBase64(buffer: ArrayBuffer) {
    var binary = "";
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function _base64ToArrayBuffer(base64: string) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

const ecdhDevParams: EcdhKeyDeriveParams | EcKeyImportParams = {
    name: "ECDH",
    namedCurve: "P-256",
};
const aesParams: AesGcmParams | AesDerivedKeyParams = {
    name: "AES-GCM",
    length: 256,
};

const socket = io("wss://api.siidhee.sh");

interface MatchContext {
    helloCounter: number;
    myPrivateKey: any;
    myPublicKey: any;
    bobRawKey: any;
    sharedKey: any;
    testData: any;
    target: string;
    error: any;
}

/*
const generateKeyPair = exportRawKey = importBobKey = generateSharedKey = encryptTest = checkTest = (
    context: MatchContext
) =>
    new Promise((resolve, reject) => {
        setTimeout(
            () =>
                Math.random() >= 0.1
                    ? resolve({})
                    : reject(new Error("key processing failed")),
            3000
        );
    });
*/

const generateKeyPair = () =>
    window.crypto.subtle.generateKey(ecdhDevParams, false, [
        "deriveKey",
        "deriveBits",
    ]);

const exportRawKey = (context: MatchContext, event: any) =>
    window.crypto.subtle.exportKey("raw", event.data.publicKey);

const importBobKey = (context: MatchContext, event: any) =>
    window.crypto.subtle.importKey(
        "raw",
        context.bobRawKey,
        ecdhDevParams,
        true,
        []
    );

const generateSharedKey = (context: MatchContext, event: any) =>
    window.crypto.subtle.deriveKey(
        { name: ecdhDevParams.name, public: event.data }, //event.data is bob's imported key from importBobKey
        context.myPrivateKey,
        aesParams,
        false,
        ["encrypt", "decrypt"]
    );

const encryptTest = (context: MatchContext) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(96));
    return window.crypto.subtle
        .encrypt(
            { ...aesParams, iv }, // TODO: use sequence num as auth tag
            context.sharedKey,
            new TextEncoder().encode(JSON.stringify(context.testData))
        )
        .then((encres) => [iv, encres]);
};

const checkTest = (context: MatchContext, event: any) => {
    console.log("checkTest.invoke", event);
    return window.crypto.subtle
        .decrypt(
            { ...aesParams, iv: _base64ToArrayBuffer(event.data.iv) },
            context.sharedKey,
            _base64ToArrayBuffer(event.data.enc)
        )
        .then((data) => {
            console.log("checkTest.afterDecrypt", data);
            return data;
        })
        .then((data) => JSON.parse(new TextDecoder().decode(data)))
        .then((data) => {
            console.log("checkTest.afterDecode", data);
            return data;
        });
};

const matchMachine = Machine<MatchContext>(
    {
        id: "match",
        initial: "init",
        context: {
            helloCounter: 10,
            myPrivateKey: undefined,
            myPublicKey: undefined,
            bobRawKey: undefined,
            sharedKey: undefined,
            testData: undefined,
            target: "",
            error: undefined,
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
                                    myPrivateKey: (_, event) =>
                                        event.data.privateKey,
                                }),
                            },
                            onError: {
                                target: "error",
                                actions: ["error"],
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
                                target: "error",
                                actions: ["error"],
                            },
                        },
                    },
                    ready: { type: "final" },
                    error: {},
                },
                onDone: "idle",
            },
            idle: {
                entry: ["resetHelloCunter"],
                on: {
                    START: "sayHello",
                },
            },
            sayHello: {
                entry: ["hello"],
                on: {
                    RECVREQ: {
                        target: "receivedRequest",
                        actions: assign({
                            target: (_, event) => event.target,
                            bobRawKey: (_, event) => event.bobRawKey,
                        }),
                    },
                    RESET: "idle",
                },
                after: {
                    2000: {
                        target: "sayHello",
                        cond: (context, _) => context.helloCounter >= 1,
                    },
                    2001: {
                        target: "helloTimeout",
                        actions: ["resetHelloCounter"],
                    },
                },
            },
            helloTimeout: {
                after: {
                    2000: "idle",
                },
            },
            receivedRequest: {
                on: {
                    ACCEPT: {
                        target: "handshake",
                        actions: ["sendPubKey"],
                    },
                    REJECT: {
                        target: "sayHello",
                        actions: ["resetHelloCounter"],
                    },
                    RESET: "idle",
                },
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
                                _arrayBufferToBase64(
                                    window.crypto.getRandomValues(
                                        new Uint8Array(10)
                                    )
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
                onDone: "matched",
                on: {
                    MATCHTEST_ACK: ".checkTest",
                    RESET: "idle",
                },
            },
            matched: {
                on: {
                    RESET: "idle",
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
);

const matchService = interpret(matchMachine).onTransition((state) => {
    console.log("matchService state Δ", state.value);
});

socket.on("DATA", (data: any[]) => {
    console.log("recv", data);
    if (Array.isArray(data)) {
        const source = data[0],
            payload = data[1];
        if (typeof payload === "object" && payload.type) {
            switch (payload.type) {
                case "MATCHREQ":
                    if (!payload.key || !matchService.state.matches("sayHello"))
                        break;
                    console.log(`received a MATCHREQ from ${source}`);
                    matchService.send("RECVREQ", {
                        target: source,
                        bobRawKey: _base64ToArrayBuffer(payload.key),
                    });
                    break;
                case "MATCHTEST_ACK":
                    if (
                        !payload.data ||
                        !matchService.state.matches("handshake.encryptTest")
                    )
                        break;
                    console.log(`received a MATCHTEST_ACK from ${source}`);
                    matchService.send("MATCHTEST_ACK", { data: payload.data });
                    break;
                default:
                    break;
            }
        }
    }
});

socket.on("disconnect", () =>
    matchService.send("RESET", { reason: "socketerror" })
);

matchService.start();

const Main = (props: any) => {
    const [matchState, matchSend] = useService(matchService); // rerender on matchState change

    return (
        <main
            data-machine={matchMachine.id}
            data-state={matchState.toStrings().join(" ")}
            style={{ margin: "10px" }}
        >
            <header>Main page: {matchState.toStrings().join(" ")}</header>
            <div>
                {matchState.matches("init.error") && (
                    <p>init error: {matchState.context.error.data.message}</p>
                )}
                {matchState.matches("init") && <h1>LOADING...</h1>}

                <h1>{matchState.matches("idle") ? "idle" : null}</h1>
                <h1>
                    {matchState.matches("sayHello") ? "saying hello" : null}
                </h1>
                <h1>
                    {matchState.matches("receivedRequest")
                        ? "received request"
                        : null}
                </h1>
                <h1>
                    {matchState.matches("helloTimeout")
                        ? "hello timed out!"
                        : null}
                </h1>
                <p>helloCounter: {matchState.context.helloCounter}</p>
                <p>target: {matchState.context.target}</p>
                {matchState.matches("idle") && (
                    <Button onClick={() => matchSend("START")}>
                        Find match
                    </Button>
                )}
                {matchState.matches("receivedRequest") && (
                    <div>
                        <Button onClick={() => matchSend("ACCEPT")}>
                            Accept
                        </Button>
                        <Button onClick={() => matchSend("REJECT")}>
                            Reject
                        </Button>
                    </div>
                )}
                <Button onClick={() => matchSend("RESET")}>Reset</Button>
            </div>
        </main>
    );
};

export default Main;
