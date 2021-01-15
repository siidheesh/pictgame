/* eslint-disable @typescript-eslint/no-unused-vars */
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
    // derive my key pair
    const keyPair: CryptoKeyPair = await window.crypto.subtle.generateKey(
        ecdhDevParams,
        false,
        ["deriveKey", "deriveBits"]
    );

    const myPubJwk: JsonWebKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    // send myPubKey to bob here

    // receive bob's pub key in jwk format
    const bobPubJwk: JsonWebKey = {};
    const bobPubKey: CryptoKey = await window.crypto.subtle.importKey(
        "jwk",
        bobPubJwk,
        ecdhDevParams,
        true,
        []
    );
    
    // generate shared key
    const sharedKey: CryptoKey = await window.crypto.subtle.deriveKey(
        { name: ecdhDevParams.name, public: bobPubKey },
        keyPair.privateKey,
        aesParams,
        false,
        ["encrypt", "decrypt"]
    );

    // send some data to bob
    const res = {};

    // generate iv and encrypt response
    const iv: Uint8Array = window.crypto.getRandomValues(new Uint8Array(96));
    const encres = await window.crypto.subtle.encrypt(
        { ...aesParams, iv},
        sharedKey,
        new TextEncoder().encode(JSON.stringify(res))
    );
    const encryptedResponse = {iv, encres};

    // send encryptedResponse to bob here

    // recv data from bob
    const recvdata = encryptedResponse;
    const decres = await window.crypto.subtle.decrypt(
        { ...aesParams, iv: new Uint8Array(recvdata.iv/*.data*/) },
        sharedKey,
        new Uint8Array(recvdata.encres/*.data*/)
    );

    const decrypedResponse = JSON.parse(new TextDecoder().decode(decres));

    // TODO: send hex strings instead of buffers
};
