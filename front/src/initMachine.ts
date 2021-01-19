import { Machine, interpret, actions, assign, send, sendParent } from "xstate";
import { ecdhDevParams, _arrayBufferToBase64 } from "./util";
const { escalate } = actions;

export const generateKeyPair = () =>
    window.crypto.subtle.generateKey(ecdhDevParams, false, [
        "deriveKey",
        "deriveBits",
    ]);

export const exportRawKey = (context: any, event: any) =>
    window.crypto.subtle.exportKey("raw", event.data.publicKey).then(_arrayBufferToBase64);

export const initMachine = {
    initial: "generatingKeys",
    states: {
        generatingKeys: {
            invoke: {
                id: "generateKeyPair",
                src: generateKeyPair,
                onDone: {
                    target: "exportRawKey",
                    actions: assign({
                        myPrivateKey: (_, event: any) => event.data.privateKey,
                    }),
                },
                onError: {
                    target: "error",
                    actions: send("GEN_KEYS_ERR"),
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
                        myPublicKey: (_, event: any) => event.data,
                    }),
                },
                onError: {
                    target: "error",
                    actions: send("EXPORT_KEYS_ERR"),
                },
            },
        },
        ready: {
            always: "disconnect",
            type: "final",
        },
        error: {},
    },
};
