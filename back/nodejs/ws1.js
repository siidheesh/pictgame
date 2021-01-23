const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const PORT = process.env.PORT || 5000;

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "https://app.siidhee.sh",
    methods: ["GET", "POST"],
  },
});
const { nanoid } = require("nanoid");
const Redis = require("ioredis");
const { redisOpt, clientChannel, serverChannel } = require("./util");

const pub = new Redis(redisOpt);
const clientsub = new Redis(redisOpt);
clientsub.subscribe(clientChannel);

const { raftService, imTheLeader } = require("./raftMachine");
const instanceId = raftService.state.context.instanceId;

const msgType = Object.freeze({
  HELLO: 1,
  DATA: 2,
  MATCH_REQ: 3,
  MATCH_DECREE: 4,
});

let lastWaitingPlayer = ""; // a len-1 fifo

const pubMsgIsValid = (msg) =>
  Array.isArray(msg) &&
  ((msg[0] === msgType.DATA && msg.length === 4) ||
    (msg[0] === msgType.HELLO && msg.length === 3) ||
    (msg[0] === msgType.MATCH_REQ && msg.length === 2) ||
    (msg[0] === msgType.MATCH_DECREE && msg.length === 3));

clientsub.on("message", (chn, origMsg) => {
  let msg = null;

  if (chn === clientChannel) {
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
      case msgType.MATCH_REQ: // msg: [type, source, target]
        if (imTheLeader()) {
          //pub.get("pictgame_lwp").then((lastWaitingPlayer) => {});
          if (lastWaitingPlayer && lastWaitingPlayer !== msg[1]) {
            debug(lastWaitingPlayer, " available, informing", msg[1]);
            pub.publish(
              clientChannel,
              JSON.stringify([msgType.MATCH_DECREE, msg[1], lastWaitingPlayer])
            );
            lastWaitingPlayer = "";
            //pub.del("pictgame_lwp");
          } else {
            debug("no available players, saving", msg[1]);
            //pub.set("pictgame_lwp", msg[1]);
            lastWaitingPlayer = msg[1];
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

  socket.on("MATCHREQ", () => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.MATCH_REQ, socket.uuid])
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
