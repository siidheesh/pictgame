// TODO: move to consts.js
// network congestions could cause hb timeouts if the message broker is not on the same machine as the server instances

const redisOpt = {
  host: "192.168.1.65",
  port: 6379,
  enableAutoPipelining: true,
};

const SERVER_IDS_KEY = "pgserv_ids";
const CLIENT_NAMES_KEY = "pgclnt_ids";

const clientChannel = "pgclnt";
const serverChannel = "pgserv";
const raftChannel = "pgraft";

const getRandInRange = (min, max) => {
  return Math.floor(0.5 + Math.random() * (max + 1 - min) + min);
};

function _arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function _base64ToArrayBuffer(base64) {
  return Buffer.from(base64, "base64");
}

module.exports = {
  getRandInRange,
  _arrayBufferToBase64,
  _base64ToArrayBuffer,
  redisOpt,
  clientChannel,
  serverChannel,
  raftChannel,
  SERVER_IDS_KEY,
  CLIENT_NAMES_KEY,
};
