const Redis = require("ioredis");
const {
  redisOpt,
  clientChannel,
  _arrayBufferToBase64,
  _base64ToArrayBuffer,
} = require("./util");

//FIXME: fix crappy code

const {
  generateKeyPair,
  exportRawKey,
  importBobKey,
  generateSharedKey,
  replyTest,
  encryptObject,
  decryptObject,
} = require("./crypto");

const msgType = Object.freeze({
  HELLO: 1,
  DATA: 2,
  MATCH_REQ: 3,
  MATCH_DECREE: 4,
  NAME_REQUEST: 5,
  NAME_DECREE: 6,
  INFORM_DISCONNECT: 7,
});

const pubMsgIsValid = (msg) =>
  Array.isArray(msg) &&
  ((msg[0] === msgType.DATA && msg.length === 4) ||
    (msg[0] === msgType.HELLO && msg.length === 3) ||
    (msg[0] === msgType.MATCH_REQ &&
      msg.length === 3 &&
      "level" in msg[2] &&
      "allowLower" in msg[2]) ||
    (msg[0] === msgType.MATCH_DECREE && msg.length === 3) ||
    (msg[0] === msgType.NAME_REQUEST && msg.length === 3) ||
    (msg[0] === msgType.NAME_DECREE && msg.length === 3) ||
    (msg[0] === msgType.INFORM_DISCONNECT && msg.length === 3));

const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);

const name = "PictBot 🤖";

// FIXME: fix this crap
const matchReqCount = {};
const sharedKeys = {};
let publicKey, privateKey, rawPubKey;

sub.on("message", (chn, msg) => {
  switch (chn) {
    case clientChannel:
      processClientMsg(msg);
      break;
    default:
      break;
  }
});

const processClientMsg = (origMsg) => {
  let msg = null;
  try {
    msg = JSON.parse(origMsg);
  } catch (e) {
    debug(e);
    return;
  }

  if (!pubMsgIsValid(msg)) return;
  switch (msg[0]) {
    case msgType.MATCH_REQ: {
      const [_, source, __] = msg;
      processMatchReq(source);
      break;
    }
    case msgType.DATA: {
      const [_, source, target, payload] = msg;
      if (target === name) processData(source, payload);
      break;
    }
    case msgType.INFORM_DISCONNECT: {
      const [_, source, __] = msg;
      cleanup(source);
    }
    default:
      break;
  }
};

const processMatchReq = (source) => {
  matchReqCount[source] = matchReqCount[source] ? matchReqCount[source] + 1 : 1;
  console.log("processMatchReq", source, matchReqCount[source]);
  if (matchReqCount[source] > 2) {
    delete matchReqCount[source];
    console.log("matching with", source);
    pub.publish(
      clientChannel,
      JSON.stringify([
        msgType.DATA,
        name,
        source,
        { type: "MATCHCHECK", key: rawPubKey },
      ])
    );
  }
};

const processData = async (source, payload) => {
  if (payload.type) {
    console.log("processData", source, "sent a", payload.type);
    switch (payload.type) {
      case "MATCHCHECKACK":
        if (!payload.key) break;
        try {
          const bobKey = await importBobKey(payload.key);
          sharedKeys[source] = await generateSharedKey(privateKey, bobKey);
        } catch (e) {
          console.log(e);
        }
        break;
      case "MATCHTEST":
        if (!payload.iv || !payload.enc || !sharedKeys[source]) break;
        try {
          const { iv, enc } = await replyTest(sharedKeys[source], {
            iv: payload.iv,
            enc: payload.enc,
          });
          pub.publish(
            clientChannel,
            JSON.stringify([
              msgType.DATA,
              name,
              source,
              {
                type: "MATCHTEST_REPLY",
                iv,
                enc,
              },
            ])
          );
        } catch (e) {
          console.log(e);
        }
        break;
      case "MATCHTEST_ACK":
        console.log("MATCHTEST_ACK", source);
        pub.publish(
          clientChannel,
          JSON.stringify([
            msgType.DATA,
            name,
            source,
            {
              type: "USER_ACCEPTS",
            },
          ])
        );
        break;
      case "BOB_DREW":
        console.log("sending BOB_DREW to", source);
        try {
          const ivenc = await encryptObject(sharedKeys[source], {
            type: "BOB_DREW",
            pic: payload.pic,
            label: `${payload.label} 🤭`,
          });
          pub.publish(
            clientChannel,
            JSON.stringify([msgType.DATA, name, source, ivenc])
          );
        } catch (e) {
          console.log(e);
        }
        break;
      case "BOB_GUESSED":
        console.log("sending BOB_GUESSED to", source);
        try {
          const ivenc1 = await encryptObject(sharedKeys[source], {
            type: "BOB_GUESSED",
            guess: `${payload.guess}? 🤭`,
          });
          pub.publish(
            clientChannel,
            JSON.stringify([msgType.DATA, name, source, ivenc1])
          );
        } catch (e) {
          console.log(e);
        }
        break;
      case "REMATCH?":
        console.log("sending REMATCH_OK to", source);
        pub.publish(
          clientChannel,
          JSON.stringify([msgType.DATA, name, source, { type: "REMATCH_OK" }])
        );
        break;
      case "USER_TIMEDOUT":
      case "USER_REJECTS":
      case "BOB_QUIT":
        cleanup(source);
        break;
      default:
        break;
    }
  } else if (payload.iv && payload.enc && sharedKeys[source]) {
    decryptObject(sharedKeys[source], payload.iv, payload.enc)
      .then((plainobj) => processData(source, plainobj))
      .catch(console.log);
  }
};

const cleanup = (source) => {
  delete sharedKeys[source];
  delete matchReqCount[source];
};

(async () => {
  ({ publicKey, privateKey } = await generateKeyPair());
  rawPubKey = await exportRawKey(publicKey);
  pub.publish(
    clientChannel,
    JSON.stringify([msgType.INFORM_DISCONNECT, name, null])
  );
  sub.subscribe(clientChannel);
})();
