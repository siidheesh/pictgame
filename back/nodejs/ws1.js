const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const PORT = process.env.PORT || 5000;

const { nanoid } = require("nanoid");
const instanceId = process.env.PORT || nanoid();

const cors = require("cors");
const bodyParser = require("body-parser");
const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: [
      "https://app.siidhee.sh",
      "http://localhost:3001",
      "https://pg.siid.sh",
    ],
    methods: ["GET", "POST"],
  },
});

const Redis = require("ioredis");
const {
  redisOpt,
  clientChannel,
  serverChannel,
  SERVER_IDS_KEY,
  CLIENT_NAMES_KEY,
  generateUsername,
} = require("./util");

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
  NAME_REQUEST: 5,
  NAME_DECREE: 6,
  INFORM_DISCONNECT: 7,
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
    (msg[0] === msgType.MATCH_DECREE && msg.length === 3) ||
    (msg[0] === msgType.NAME_REQUEST && msg.length === 3) ||
    (msg[0] === msgType.NAME_DECREE && msg.length === 3) ||
    (msg[0] === msgType.INFORM_DISCONNECT && msg.length === 3));

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
    case msgType.NAME_REQUEST: // msg: [type, source, instanceId]
      if (imTheLeader()) {
        const randomName = (maxTries) => {
          const name = generateUsername();
          return (
            pub
              // get list of servers
              .smembers(SERVER_IDS_KEY)
              // for each server, check its clients for a matching name
              .then((serverIds) =>
                Promise.all(
                  serverIds.map((serverId) =>
                    pub.sismember(`${CLIENT_NAMES_KEY}_${serverId}`, name)
                  )
                )
              )
              // check if all false
              .then((serverResults) => {
                if (serverResults.every((res) => !res)) {
                  return name; // return name if successful
                } else if (maxTries <= 0) {
                  return Promise.reject("cannot generate unique name");
                } else return randomName(maxTries - 1);
              })
          );
        };

        randomName(2)
          .then((name) => {
            pub.publish(
              clientChannel,
              JSON.stringify([msgType.NAME_DECREE, msg[1], name])
            );
            pub.sadd(`${CLIENT_NAMES_KEY}_${msg[2]}`, name);
          })
          .catch(debug); // ignore errors
      }
      break;
    case msgType.NAME_DECREE: // msg: [type, target, name]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.uuid === msg[1]) {
          socket.username = msg[2];
          debug(`${msg[1]} is henceforth ${socket.username}`);
          socket.emit("NAME_DECREE", msg[2]);
          if (socket.uuid) delete socket.uuid;
          found = true;
        }
      });
      break;
    case msgType.DATA: // msg: [type, source, target, payload]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (
          socket &&
          socket.username === msg[2] &&
          (!socket.matchedWith || socket.matchedWith === msg[1]) // filter DATA if socket has match
        ) {
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
        const minLevel = allowLower ? 0 : origLevel; // only check equally-or-higher rated bins if not allowLower
        let matchFound = false;

        for (let l = maxLevel; l >= minLevel; l--) {
          if (
            waitingPlayers[l].id &&
            waitingPlayers[l].id !== msg[1] &&
            (waitingPlayers[l].allowLower || origLevel >= l)
          ) {
            // match
            debug(`asking ${msg[1]} to match with ${waitingPlayers[l].id}`);
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
          debug("no matches:", msg[1], level, allowLower);
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
        else if (socket && socket.username === msg[2]) {
          socket.emit("MATCH_DECREE", msg[1]);
          found = true;
        }
      });
      break;
    case msgType.INFORM_DISCONNECT: // msg: [type, source, target]
      // TODO: if a server crashes, the leader could publish all the clientnames of said server, informing their opps, if any, of their disconnection
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.username === msg[2]) {
          // inform target that source has disconnected, and if target is matchedWith source, clear that as well
          if (socket?.matchedWith === msg[1]) delete socket.matchedWith;
          socket.emit("INFORM_DISCONNECT", msg[1]);
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

  debug(`${socket.uuid} connected`);

  socket.on("NAME_REQUEST", (data) => {
    if (socket.username) {
      socket.emit("NAME_DECREE", socket.username);
    } else
      pub.publish(
        clientChannel,
        JSON.stringify([msgType.NAME_REQUEST, socket.uuid, instanceId])
      );
  });

  socket.on("MATCHREQ", (options) => {
    socket.username && // BUG: when throttling, it seems multiple sockets are created, and username never gets set? to be investigated
      pub.publish(
        clientChannel,
        JSON.stringify([msgType.MATCH_REQ, socket.username, options])
      );
  });

  socket.on("MATCHED", (name) => {
    // client tells us who to inform if/when they deconnect
    socket.matchedWith = name;
  });

  socket.on("UNMATCHED", () => {
    delete socket.matchedWith;
  });

  socket.on("DATA", (target, data) => {
    socket.username &&
      pub.publish(
        clientChannel,
        JSON.stringify([msgType.DATA, socket.username, target, data])
      );
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      socket.matchedWith &&
        pub.publish(
          clientChannel,
          JSON.stringify([
            msgType.INFORM_DISCONNECT,
            socket.username,
            socket.matchedWith,
          ])
        );
      pub.srem(`${CLIENT_NAMES_KEY}_${instanceId}`, socket.username);
      debug(`${socket.username} disconnected`);
    }
  });

  socket.emit("INIT");
});

pub.sadd(SERVER_IDS_KEY, instanceId); // add self to server list
pub.del(`${CLIENT_NAMES_KEY}_${instanceId}`); // clear client list on start

app.set("trust proxy", 1);

var corsOptions = {
  origin: [
    "https://app.siidhee.sh",
    "http://localhost:3001",
    "https://pg.siid.sh",
  ],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.post("/metrics", cors(corsOptions), bodyParser.text(), (req, res) => {
  let metrics = {};
  try {
    metrics = JSON.parse(req.body);
  } catch (e) {
    debug(e, req.body);
    res.sendStatus(400);
    return;
  }
  debug("received metrics", metrics);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  //res.sendFile(__dirname + "/index.html");
  res.sendStatus(204);
});

http.listen(PORT, () => {
  console.log(`server ${instanceId} listening on *:${PORT}`);
});

process.on("SIGINT", async () => {
  /*debug("tearing down");
  io.sockets.sockets.forEach((socket) => {
    if (socket && socket.username) {
      debug("removing", socket.username);
      pub.srem(CLIENT_NAMES_KEY, socket.username);
    }
  });
  debug("exiting");*/
  process.exit();
});
