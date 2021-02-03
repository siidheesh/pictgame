const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const PORT = process.env.PORT || 5000;

const { nanoid } = require("nanoid");
const instanceId = process.env.ID || nanoid();

const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} = require("unique-names-generator");
const usernameConfig = {
  dictionaries: [adjectives, colors, animals],
  separator: "",
  style: "capital",
};
const CLIENT_NAMES_KEY = "pictgame_client_names";

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: ["https://app.siidhee.sh", "http://localhost:3001"],
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
  NAME_REQUEST: 5,
  NAME_DECREE: 6,
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
    (msg[0] === msgType.NAME_REQUEST && msg.length === 2) ||
    (msg[0] === msgType.NAME_DECREE && msg.length === 3));

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
    case msgType.NAME_REQUEST: // msg: [type, source]
      if (imTheLeader()) {
        const randomName = (maxIter) => {
          const name = uniqueNamesGenerator(usernameConfig);
          //debug(`randomName iter ${maxIter}: ${name}`);
          return pub.sismember(CLIENT_NAMES_KEY, name).then((res) => {
            if (res) {
              return randomName(maxIter - 1);
            } else if (maxIter <= 0) {
              return false;
            } else return name;
          });
        };

        randomName(5).then((name) => {
          if (name) {
            pub.publish(
              clientChannel,
              JSON.stringify([msgType.NAME_DECREE, msg[1], name])
            );
            pub.sadd(CLIENT_NAMES_KEY, name);
          }
        });
      }
      break;
    case msgType.NAME_DECREE: // msg: [type, target, name]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.uuid === msg[1]) {
          socket.username = msg[2];
          debug(`${msg[1]} is henceforth ${socket.username}`);
          socket.emit("NAME_DECREE", msg[2]);
          delete socket.uuid;
          found = true;
        }
      });
      break;
    case msgType.DATA: // msg: [type, source, target, payload]
      io.sockets.sockets.forEach((socket) => {
        if (found) return;
        else if (socket && socket.username === msg[2]) {
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

  debug(`${socket.uuid} connected`);

  socket.on("NAME_REQUEST", (data) => {
    if (socket.username) {
      socket.emit("NAME_DECREE", socket.username);
    } else
      pub.publish(
        clientChannel,
        JSON.stringify([msgType.NAME_REQUEST, socket.uuid])
      );
  });

  socket.on("MATCHREQ", (options) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.MATCH_REQ, socket.username, options])
    );
  });

  socket.on("DATA", (target, data) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.DATA, socket.username, target, data])
    );
  });

  socket.on("disconnect", () => {
    debug(`${socket.username} disconnected`);
    pub.srem(CLIENT_NAMES_KEY, socket.username);
    //socket.username = undefined;
    //socket.id = undefined;
  });

  socket.emit("INIT");
});

//pub.sscanStream(CLIENT_NAMES_KEY, { match: `${instanceId}:` });

app.set("trust proxy", 1);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
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
