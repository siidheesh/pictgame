import { createMachine, assign } from "xstate";
import { io } from "socket.io-client";

interface MatchContext {
    matchId: string;
}

export const matchMachine = createMachine<MatchContext>({
    id: "match",
    initial: "idle",
    context: {
        matchId: "",
    },
    states: {
        idle: {
            on: {
                START: ".sayHello",
            },
        },
        sayHello: {
            on: {
                SENDREQ: ".sendRequest",
                END: ".idle",
            },
            after: {
                2000: ".sayHello",
            },
        },
        sendRequest: {
            on: {
                MATCHED: ".matched",
                END: ".idle",
            },
            after: {
                2000: ".idle",
            },
        },
        matched: {
            on: {
                END: ".idle",
            },
        },
    },
});

const socket = io("wss://api.siidhee.sh");

const cryptoTest = async () => {
    const ecdhDevParams: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
    const aesParams: AesDerivedKeyParams = { name: "AES-GCM", length: 256 };
    const keyPair = await window.crypto.subtle.generateKey(
        ecdhDevParams,
        false,
        ["deriveKey", "deriveBits"]
    );
    const myPubKey = await crypto.subtle.exportKey("jwt", keyPair.publicKey);

    // send myPubKey to bob here

    // receive bob's pub key in jwk format
    const bobJwk = {};
    const bobPubKey = await window.crypto.subtle.importKey(
        "jwk",
        bobJwk,
        ecdhDevParams,
        true,
        []
    );
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: ecdhDevParams.name, public: bobPubKey },
        keyPair.privateKey,
        256
    );
    const sharedKey = await window.crypto.subtle.deriveKey(
        { name: ecdhDevParams.name, public: bobPubKey },
        keyPair.privateKey,
        aesParams,
        false,
        ["encrypt", "decrypt"]
    );

    // send some data to Bob
    const res = {};
    const encres = await window.crypto.subtle.encrypt(
        { ...aesParams, iv: sharedSecret },
        sharedKey,
        new TextEncoder().encode(JSON.stringify(res))
    );

    // send encres to bob here

    // recv data from bob
    const recvdata = { data: [] };
    const decres = await window.crypto.subtle.decrypt(
        { ...aesParams, iv: sharedSecret },
        sharedKey,
        new Uint8Array(recvdata.data)
    );
    console.log(JSON.parse(new TextDecoder().decode(decres)));
};
