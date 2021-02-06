import {
  MainContext,
  _arrayBufferToBase64,
  _base64ToArrayBuffer,
} from "./util";

export const ecdhDevParams: EcdhKeyDeriveParams | EcKeyImportParams = {
  name: "ECDH",
  namedCurve: "P-256",
};

export const aesParams: AesGcmParams | AesDerivedKeyParams = {
  name: "AES-GCM",
  length: 256,
};

export const generateKeyPair = () =>
  window.crypto.subtle.generateKey(ecdhDevParams, false, [
    "deriveKey",
    "deriveBits",
  ]);

export const exportRawKey = (context: any, event: any) =>
  window.crypto.subtle
    .exportKey("raw", event.data.publicKey)
    .then(_arrayBufferToBase64);

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

export const encrypt = (sharedKey: any, data: any) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(96));
  return window.crypto.subtle
    .encrypt(
      { ...aesParams, iv }, // TODO: use sequence num as auth tag
      sharedKey,
      data
    )
    .then((encres) => ({
      iv: _arrayBufferToBase64(iv),
      enc: _arrayBufferToBase64(encres),
    }));
};

export const decrypt = (sharedKey: any, iv: any, enc: any) =>
  window.crypto.subtle.decrypt(
    { ...aesParams, iv: _base64ToArrayBuffer(iv) }, // TODO: use sequence num as auth tag
    sharedKey,
    _base64ToArrayBuffer(enc)
  );

export const encryptTest = (context: any) =>
  encrypt(context.sharedKey, context.testData);

const handleTest = (context: MainContext, event: any) =>
  decrypt(context.sharedKey, event.iv, event.enc).then((testData) =>
    new Uint8Array(testData).map((el) => 255 - el)
  );

export const checkTest = (context: MainContext, event: any) =>
  handleTest(context, event).then(
    (resData) =>
      _arrayBufferToBase64(resData) !==
        _arrayBufferToBase64(context.testData) && Promise.reject()
  );

export const replyTest = (context: MainContext, event: any) =>
  handleTest(context, event).then((resData) =>
    encryptTest({ sharedKey: context.sharedKey, testData: resData })
  );
