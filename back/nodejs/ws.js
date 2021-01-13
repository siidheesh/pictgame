// pictgame socket,io backend

const debug =
  process.env.NODE_ENV === "development" || true ? console.log : () => {};
const PORT = process.env.PORT || 5000;
const serverId = process.env.SERVERID ? `pgn_${process.env.SERVERID}` : "pgn_1";
const redisOpt = {
  host: "192.168.1.39",
  port: 6379,
  enableAutoPipelining: true,
};

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const Redis = require("ioredis");
const { resolve } = require("path");
const { uuidv4 } = require("./util");

const redis = new Redis(redisOpt);
const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);

const serverInstances = new Set();

redis.on("error", debug);

sub.subscribe("pictgame", serverId, (err, count) => {
  serverInstances.add(serverId);
  pub.publish("pictgame", JSON.stringify({ type: "connect", serverId }));
});

sub.on("message", (chn, msg) => {
  debug(chn, msg);
  const msgobj = JSON.parse(msg);
  if (
    msgobj &&
    "type" in msgobj &&
    "serverId" in msgobj &&
    msgobj.serverId !== serverId
  ) {
    switch (msgobj.type) {
      case "connect":
        serverInstances.add(msgobj.serverId); //we have to guarantee unique serverIds' when spinning up server instances
        pub.publish(
          msgobj.serverId,
          JSON.stringify({ type: "hello", serverId })
        ); // announce ourselves to the new instance
        debug(serverInstances);
        break;
      case "disconnect": // another inst has disconnected
        serverInstances.delete(msgobj.serverId);
        debug(serverInstances);
        break;
      case "helol": // another inst is saying hello
        serverInstances.add(msgobj.serverId);
        // we should probe if this inst has clients available
        debug(serverInstances);
        break;
      case "client_connect":
        debug(`${msgobj.serverId} has a new client ${msgobj.cilentId}`);
        //newClientDiscovered(msgobj.servedId, msgobj.cilentId);
        break;
      default:
        debug("unknown msg type");
        break;
    }
  }
});

io.on("connection", async (socket) => {
  debug(`${socket.id} connected`);

  let res,
    id,
    count = 0;

  do {
    id = uuidv4();
    res = await redis.sismember(serverId, id);
  } while (res > 1 && count++ < 10);
  socket.uuid = id;

  res = await redis.sadd(serverId, socket.uuid);
  if (res != 1) {
    debug(res);
  } else debug(`${socket.id} assigned uuid ${socket.uuid} and added to store`);

  //socket.emit({uuid: socket.uuid});

  socket.on("chat message", (msg) => {
    console.log(`${socket.uuid}: ${msg}`);
  });

  socket.on("disconnect", () => {
    console.log(`${socket.uuid} disconnected`);
    redis.srem(serverId, socket.uuid).then((err, res) => {
      if (err) {
        debug(err);
      } else {
        debug(`${socket.uuid} removed from store`);
      }
    });
  });

  socket.on("find", () => {});

  pub.publish(
    "pictgame",
    JSON.stringify({ type: "client_connect", serverId, cilentId: socket.id })
  );
});

app.set("trust proxy", 1);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

http.listen(PORT, () => {
  console.log(`server ${serverId} listening on *:${PORT}`);
});

// catching signals and do something before exit
const signals = [
  "SIGHUP",
  "SIGINT",
  "SIGQUIT",
  "SIGILL",
  "SIGTRAP",
  "SIGABRT",
  "SIGBUS",
  "SIGFPE",
  "SIGUSR1",
  "SIGSEGV",
  "SIGUSR2",
  "SIGTERM",
];

async function terminator(sig) {
  debug("recveived signal: " + sig);
  await pub.publish(
    "pictgame",
    JSON.stringify({ type: "disconnect", serverId })
  ); //inform other instances that we have been killed
  await redis.del(serverId); //delete client list on store after informing other instances
  io.emit("disconnected"); //inform our clients
  process.exit(1);
}

signals.forEach((sig) => {
  process.on(sig, terminator);
});

process.on("exit", () => {
  debug("exodus");
});
