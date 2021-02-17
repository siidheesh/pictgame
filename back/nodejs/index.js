const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const PORT = process.env.PORT || 5000;

const { nanoid } = require("nanoid");
const instanceId = process.env.PORT || nanoid();
const chalk = require("chalk");
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
  raftChannel,
  SERVER_IDS_KEY,
  CLIENT_NAMES_KEY,
  generateUsername,
  getRandInRange,
  getPics,
  readPic,
  savePic,
} = require("./util");

const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);
sub.subscribe(clientChannel, serverChannel, raftChannel);

const playerLevelBinLength = 3;
let waitingPlayers = Array(playerLevelBinLength)
  .fill()
  .map((x) => ({}));

const msgType = Object.freeze({
  HELLO: 1,
  DATA: 2,
  MATCH_REQ: 3,
  MATCH_DECREE: 4,
  NAME_REQUEST: 5,
  NAME_DECREE: 6,
  INFORM_DISCONNECT: 7,
});

const serverMsgType = Object.freeze({
  SERVER_UP: 1,
  CLEARED_TO_START: 2,
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

const serverMsgIsValid = (msg) =>
  Array.isArray(msg) &&
  ((msg[0] === serverMsgType.SERVER_UP && msg.length === 2) ||
    (msg[0] === serverMsgType.CLEARED_TO_START && msg.length === 3));

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
                    pub.hexists(`${CLIENT_NAMES_KEY}_${serverId}`, name)
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
            // add key to client names hash, value representing the client's match
            pub.hset(`${CLIENT_NAMES_KEY}_${msg[2]}`, name, null);
          })
          .catch(debug); // ignore errors
      }
      break;
    case msgType.NAME_DECREE: // msg: [type, target, name]
      for (const socket of io.sockets.sockets.values()) {
        if (socket?.uuid === msg[1]) {
          socket.username = msg[2];
          //debug(`${msg[1]} is henceforth ${socket.username}`);
          socket.emit("NAME_DECREE", msg[2]);
          if (socket.uuid) delete socket.uuid;
          break;
        }
      }
      break;
    case msgType.DATA: // msg: [type, source, target, payload]
      for (const socket of io.sockets.sockets.values()) {
        if (
          socket?.username === msg[2] &&
          (!socket?.matchedWith || socket.matchedWith === msg[1]) // filter DATA if socket has match
        ) {
          socket.emit("DATA", [msg[1], msg[3]]);
          break;
        }
      }
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
            debug(
              chalk.green(
                `asking ${msg[1]} to match with ${waitingPlayers[l].id}`
              )
            );
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
      for (const socket of io.sockets.sockets.values()) {
        if (socket?.username === msg[1]) {
          socket.emit("MATCH_DECREE", msg[2]);
          break;
        }
      }
      break;
    case msgType.INFORM_DISCONNECT: // msg: [type, source, target]
      // TODO: if a server crashes, the leader could publish all the clientnames of said server, informing their opps, if any, of their disconnection
      if (imTheLeader()) {
        debug(chalk.yellow(`${msg[1]} disconnected, cleaning up`));
        // need to clear bin(s) referring to the disconnected player, if any
        waitingPlayers = waitingPlayers.map((bin) =>
          bin.id !== msg[1] ? bin : {}
        );
      }
      for (const socket of io.sockets.sockets.values()) {
        if (
          (msg[2] && socket?.username === msg[2]) ||
          socket?.matchedWith === msg[1]
        ) {
          // inform target that source has disconnected, and if target is matchedWith source, clear that as well
          if (socket?.matchedWith === msg[1]) delete socket.matchedWith;
          socket.emit("INFORM_DISCONNECT", msg[1]);
          break;
        }
      }
      break;
    default:
      debug(chalk.red(`unknown msg.type ${msg[0]}: ${origMsg}`));
      break;
  }
};

// TODO: send and receive hb msgs on this channel
const processServerMsg = (origMsg) => {
  let msg = null;
  try {
    msg = JSON.parse(origMsg);
  } catch (e) {
    debug(e);
    return;
  }

  if (!serverMsgIsValid(msg)) return;

  switch (msg[0]) {
    case serverMsgType.SERVER_UP: // msg: [type, source]
      if (imTheLeader()) {
        // assume server crashed and restarted, perform cleanup
        debug(chalk.yellow.bold(msg[1], "spun up! cleaning up"));
        pub.hgetall(`${CLIENT_NAMES_KEY}_${msg[1]}`).then((clients) => {
          debug(`${msg[1]}'s prev clients:`, clients);
          for (const id in clients) {
            // pub INFORM_DISCONNECT for each client
            if (id)
              pub.publish(
                clientChannel,
                JSON.stringify([
                  msgType.INFORM_DISCONNECT,
                  id,
                  clients[id] ?? null,
                ])
              );
          }
          pub.publish(
            serverChannel,
            JSON.stringify([serverMsgType.CLEARED_TO_START, instanceId, msg[1]])
          );
        });
      }
      break;
    case serverMsgType.CLEARED_TO_START: // msg: [type, source, target]
      // leader is ready for us to begin accepting clients
      if (msg[2] === instanceId /*&& getLeader() === msg[1]*/) {
        debug(chalk.green("ready to start"));
        pub.del(`${CLIENT_NAMES_KEY}_${instanceId}`); // clear client list on start
        if (!http.listening)
          // start server
          http.listen(PORT, () => {
            debug(chalk.green(`server ${instanceId} listening on *:${PORT}`));
          });
      }
      break;
    default:
      debug(chalk.red(`unknown serverMsg.type ${msg[0]}: ${origMsg}`));
      break;
  }
};

sub.on("message", (chn, msg) => {
  switch (chn) {
    case clientChannel:
      processClientMsg(msg);
      break;
    case raftChannel:
      processRaftMsg(msg);
      break;
    case serverChannel:
      processServerMsg(msg);
    default:
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
    if (socket.username)
      pub.hset(
        `${CLIENT_NAMES_KEY}_${instanceId}`,
        socket.username,
        socket.matchedWith
      );
  });

  socket.on("UNMATCHED", () => {
    delete socket.matchedWith;
    if (socket.username)
      pub.hset(`${CLIENT_NAMES_KEY}_${instanceId}`, socket.username, null);
  });

  socket.on("DATA", (target, data) => {
    socket.username &&
      pub.publish(
        clientChannel,
        JSON.stringify([msgType.DATA, socket.username, target, data])
      );
  });

  socket.on("PUBLISH", (pic) => {
    // let users publish their pics
    if (!socket.published) {
      socket.published = true;
      debug(chalk.green(socket.username, "published!"));
      getPics()
        .then((pics) =>
          pics.length <= 100
            ? Promise.resolve(pics)
            : Promise.reject(new Error("at max capacity"))
        )
        .then(savePic(socket.username, pic))
        .then(() => debug(`${socket.username}.json published`))
        .catch((e) => debug(chalk.red.bold(e)));
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      pub.publish(
        clientChannel,
        JSON.stringify([
          msgType.INFORM_DISCONNECT,
          socket.username,
          socket.matchedWith ?? null,
        ])
      );
      // delete key from client names hash
      pub.hdel(`${CLIENT_NAMES_KEY}_${instanceId}`, socket.username);
      debug(`${socket.username} disconnected`);
      debug(
        chalk.yellow.bold(
          `${io.sockets.sockets.size} connected client${
            io.sockets.sockets.size !== 1 ? "s" : ""
          }`
        )
      );
    }
  });

  socket.emit("INIT");

  debug(
    chalk.yellow.bold(
      `${io.sockets.sockets.size} connected client${
        io.sockets.sockets.size !== 1 ? "s" : ""
      }`
    )
  );
});

pub.sadd(SERVER_IDS_KEY, instanceId); // add self to server list

app.set("trust proxy", 1);
app.disable("x-powered-by");

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
  //debug("received metrics");
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  //res.sendFile(__dirname + "/index.html");
  res.sendStatus(204);
});

app.get("/randpic", cors(corsOptions), (req, res) => {
  // send random stored pic
  let rand = "",
    count = 0;
  getPics()
    .then((pics) => {
      count = pics.length;
      rand = pics[getRandInRange(0, count - 1)];
      debug("/randpic", rand);
      return readPic(rand);
    })
    .then((buf) => JSON.parse(buf.toString()))
    .then((obj) =>
      res
        .type("application/json")
        .send(JSON.stringify({ pic: obj.pic, name: rand, count }))
    )
    .catch((e) => debug(e));
});

const handleLeaderChange = () => {
  // reset waiting bins upon becoming leader
  debug("in handleLeaderChange");
  if (imTheLeader()) {
    // clear waititng bins
    waitingPlayers = Array(playerLevelBinLength)
      .fill()
      .map((x) => ({}));
  }
  if (!http.listening) {
    debug(chalk.yellow("asking leader for clearance"));
    pub.publish(
      serverChannel,
      JSON.stringify([serverMsgType.SERVER_UP, instanceId])
    );
  }
};

const { processRaftMsg, imTheLeader, getLeader } = require("./raftMachine")(
  instanceId,
  pub,
  handleLeaderChange
);
