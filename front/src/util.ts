export function _arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function _base64ToArrayBuffer(base64: string) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const ecdhDevParams: EcdhKeyDeriveParams | EcKeyImportParams = {
  name: "ECDH",
  namedCurve: "P-256",
};

export const aesParams: AesGcmParams | AesDerivedKeyParams = {
  name: "AES-GCM",
  length: 256,
};

export const getRandInRange = (min: number, max: number) => {
  return Math.floor(Math.random() * (max + 1 - min) + min);
};

export interface MainContext {
  myPrivateKey: any;
  myPublicKey: any;
  name: string;
  target: string;
  sharedKey: any;
  helloCounter: number;
  targetKey: any;
  testData: any;
  forky: boolean; // true if we responded to a MATCHREQ, false if we responded to a HELLO
  level: number;
  allowLower: boolean;
}
