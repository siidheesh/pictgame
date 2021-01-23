const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const PORT = process.env.PORT || 5000;

const { nanoid } = require("nanoid");
const instanceId = process.env.ID || nanoid();

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "https://app.siidhee.sh",
    methods: ["GET", "POST"],
  },
});

const Redis = require("ioredis");
const { redisOpt, clientChannel, serverChannel } = require("./util");

const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);
sub.subscribe(clientChannel, serverChannel);

const { processRaftMsg, imTheLeader } = require("./raftMachine")(
  instanceId,
  pub
);

const msgType = Object.freeze({
  HELLO: 1,
  DATA: 2,
  MATCH_REQ: 3,
  MATCH_DECREE: 4,
});

const playerLevelBinLength = 3;
let waitingPlayers = Array(playerLevelBinLength)
  .fill()
  .map((x) => ({}));

const pubMsgIsValid = (msg) =>
  Array.isArray(msg) &&
  ((msg[0] === msgType.DATA && msg.length === 4) ||
    (msg[0] === msgType.HELLO && msg.length === 3) ||
    (msg[0] === msgType.MATCH_REQ &&
      msg.length === 3 &&
      "level" in msg[2] &&
      "allowLower" in msg[2]) ||
    (msg[0] === msgType.MATCH_DECREE && msg.length === 3));

const processClientMsg = (origMsg) => {
  let msg = null;
  try {
    msg = JSON.parse(origMsg);
  } catch (e) {
    debug(e);
    return;
  }

  if (!pubMsgIsValid(msg)) return;

  let found = false;

  switch (msg[0]) {
    case msgType.HELLO: // msg: [type, source, payload]
      io.sockets.sockets.forEach((socket) => {
        if (socket && socket.uuid !== msg[1]) {
          socket.emit("HELLO", [msg[1], msg[2]]);
        }
      });
      break;
    case msgType.DATA: // msg: [type, source, target, payload]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.uuid === msg[2]) {
          //debug(`we have ${msg[2]}, sending ${msg[0]}`);
          socket.emit("DATA", [msg[1], msg[3]]);
          found = true;
        }
      });
      break;
    case msgType.MATCH_REQ: // msg: [type, source, {level, allowLower}]
      if (imTheLeader()) {
        const { level, allowLower } = msg[2];
        const maxLevel = waitingPlayers.length - 1;
        const origLevel = Math.min(maxLevel, level); // set bin count as limit
        const minLevel = allowLower ? 0 : origLevel; // only check equally-or-higher rated matches if not allowLower
        let matchFound = false;

        for (let l = maxLevel; l >= minLevel; l--) {
          if (
            waitingPlayers[l].id &&
            waitingPlayers[l].id !== msg[1] &&
            (waitingPlayers[l].allowLower || origLevel >= l)
          ) {
            // match
            debug("matching", waitingPlayers[l].id, "with", msg[1]);
            pub.publish(
              clientChannel,
              JSON.stringify([
                msgType.MATCH_DECREE,
                msg[1],
                waitingPlayers[l].id,
              ])
            );
            matchFound = true;
            waitingPlayers[l].id = "";
            break;
          }
        }

        if (!matchFound) {
          // no match was found
          debug("no available players, saving", msg[1]);
          waitingPlayers[origLevel] = {
            ...waitingPlayers[origLevel],
            allowLower,
            id: msg[1],
          };
        }
      }
      break;
    case msgType.MATCH_DECREE: // msg: [type, source, target]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.uuid === msg[2]) {
          //debug(`we have ${msg[2]}, sending ${msg[0]}`);
          socket.emit("MATCH_DECREE", msg[1]);
          found = true;
        }
      });
      break;
    default:
      debug(`unknown msg.type ${msg[0]}: ${JSON.stringify(msg)}`);
      break;
  }
};

sub.on("message", (chn, msg) => {
  switch (chn) {
    case clientChannel:
      processClientMsg(msg);
      break;
    case serverChannel:
      processRaftMsg(msg);
      break;
  }
});

io.on("connection", (socket) => {
  socket.uuid = nanoid();

  debug(`${socket.id} connected, uuid: ${socket.uuid}`);

  socket.on("HELLO", (data) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.HELLO, socket.uuid, data])
    );
  });

  socket.on("DATA", (target, data) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.DATA, socket.uuid, target, data])
    );
  });

  socket.on("MATCHREQ", (options) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.MATCH_REQ, socket.uuid, options])
    );
  });

  socket.emit("INIT", socket.uuid);
});

app.set("trust proxy", 1);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

http.listen(PORT, () => {
  console.log(`server ${instanceId} listening on *:${PORT}`);
});
