const { _arrayBufferToBase64, _base64ToArrayBuffer } = require("./util");
const crypto = require("crypto");
const { subtle } = crypto.webcrypto;

const ecdhDevParams = {
  name: "ECDH",
  namedCurve: "P-256",
};

const aesParams = {
  name: "AES-GCM",
  length: 256,
};

const generateKeyPair = () =>
  subtle
    ? subtle.generateKey(ecdhDevParams, false, ["deriveKey", "deriveBits"])
    : Promise.reject(new Error("SubtleCrypto not available"));

const exportRawKey = (publicKey) => subtle.exportKey("jwk", publicKey);

const importBobKey = (targetKey) =>
  subtle.importKey("jwk", targetKey, ecdhDevParams, true, []);

const generateSharedKey = (myPrivateKey, publicKey) =>
  subtle.deriveKey(
    { name: ecdhDevParams.name, public: publicKey }, //event.data is bob's imported key from importBobKey
    myPrivateKey,
    aesParams,
    false,
    ["encrypt", "decrypt"]
  );

const encrypt = (sharedKey, data) => {
  if (!sharedKey) return Promise.reject("Invalid shared key");
  const iv = crypto.randomBytes(96);
  return subtle
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

const decrypt = (sharedKey, iv, enc) =>
  sharedKey
    ? subtle.decrypt(
        { ...aesParams, iv: _base64ToArrayBuffer(iv) }, // TODO: use sequence num as auth tag
        sharedKey,
        _base64ToArrayBuffer(enc)
      )
    : Promise.reject("Invalid shared key");

const encryptObject = (sharedKey, data) =>
  encrypt(sharedKey, new TextEncoder().encode(JSON.stringify(data)));

const decryptObject = (sharedKey, iv, enc) =>
  decrypt(sharedKey, iv, enc).then((plaindata) =>
    JSON.parse(new TextDecoder().decode(plaindata))
  );

const encryptTest = (context) => encrypt(context.sharedKey, context.testData);

const handleTest = (sharedKey, ivenc) =>
  decrypt(sharedKey, ivenc.iv, ivenc.enc).then((testData) =>
    new Uint8Array(testData).map((el) => 255 - el)
  );

const checkTest = (sharedKey, ivenc, testData) =>
  handleTest(sharedKey, ivenc).then(
    (resData) =>
      _arrayBufferToBase64(resData) !== _arrayBufferToBase64(testData) &&
      Promise.reject()
  );

const replyTest = (sharedKey, ivenc) =>
  handleTest(sharedKey, ivenc).then((resData) =>
    encryptTest({ sharedKey, testData: resData })
  );

module.exports = {
  generateKeyPair,
  exportRawKey,
  importBobKey,
  generateSharedKey,
  encryptTest,
  checkTest,
  replyTest,
  encryptObject,
  decryptObject,
};
