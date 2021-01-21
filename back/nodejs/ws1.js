const isDEBUG = process.env.NODE_ENV === "development" || true;
const PORT = process.env.PORT || 5000;
const instanceId = process.env.PORT || "server";
const clientChannel = process.env.CLIENT_CHN || "pictgame_clients";
let serverChannel = process.env.SERVER_CHN || "pictgame_servers";
const redisOpt = {
  host: "192.168.1.39",
  port: 6379,
  enableAutoPipelining: true,
};

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
const { clearTimeout } = require("timers");

const pub = new Redis(redisOpt);
const clientsub = new Redis(redisOpt);
const serversub = new Redis(redisOpt);

const msgType = Object.freeze({ HELLO: 1, DATA: 2 });

const debug = isDEBUG ? console.log : () => {};

const getRandInRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

pub.on("error", debug);
clientsub.on("error", debug);
serversub.on("error", debug);
/*

client A emits HELLO => server publishes HELLO 
=> subs emit HELLO to their respective clients
=> interested clients contact A directly by emitting DATA to their server
=> A chooses one (if available) and they negotiate

TODO: 

replace this with a STUN/TURN server for webrtc p2p
add rate-limiting

*/

clientsub.subscribe(clientChannel);
serversub.subscribe(serverChannel);

const pubMsgIsValid = (msg) =>
  Array.isArray(msg) &&
  ((msg[0] === msgType.DATA && msg.length === 4) ||
    (msg[0] === msgType.HELLO && msg.length === 3));

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

    switch (msg[0]) {
      case msgType.HELLO: // msg: [type, source, payload]
        io.sockets.sockets.forEach((socket) => {
          if (socket && socket.uuid !== msg[1]) {
            socket.emit("HELLO", [msg[1], msg[2]]);
          }
        });
        break;
      case msgType.DATA: // msg: [type, source, target, payload]
        let found = false;
        io.sockets.sockets.forEach((socket) => {
          if (found) return;
          else if (socket && socket.uuid === msg[2]) {
            debug(`we have ${msg[2]}, sending ${msg[0]}`);
            socket.emit("DATA", [msg[1], msg[3]]);
            found = true;
          }
        });
        break;
      default:
        debug(`unknown msg.type ${msg[0]}: ${JSON.stringify(msg)}`);
        break;
    }
  }

  if (isDEBUG) pub.publish(chn + "_" + instanceId, origMsg); // forward messages to a debug channel. this is done to ensure only actual servers listen to the original channel (and not redis-client instances for example)
});

/*
  Consensus algorithm adapted from the Raft algo
  Used to reach a consensus among server instances on who (leaderId) the matchmaker is

  Extreme case 1: all instances agree on the same leaderId, client matchmaking takes places across all instances
  Extreme case 2: each instance is decoupled from everyone else and is its own leader, and matchmakes within its own clients

  TODO: refactor into sep. module
*/

let leaderId = ""; // property to reach consensus on
let electionTerm = 0; // current election term
let voterCount = 0; // number of instances who heard our vote request
let amCandidate = false; // whether to vote for myself or someone else
let hasVoted = false; // whether to cast a vote or not
let voteCount = 0; // number of votes for me

let votedInTerm = new Set();

let leaderTimer = null,
  heartbeatTimer = null;

const becomeCandidate = async () => {
  debug("leader TIMED OUT");
  electionTerm++;
  amCandidate = true;
  voterCount = await pub.publish(
    serverChannel,
    JSON.stringify({
      type: "VOTE4ME",
      instanceId,
      electionTerm,
    })
  );
  voteCount = 0;
  leaderTimer = startLeaderTimer(leaderTimer);
  debug(
    "called for new election term",
    electionTerm,
    "with",
    voterCount,
    "voter(s)"
  );
};

const startLeaderTimer = (timer) => {
  if (timer) clearTimeout(timer);
  if (leaderId !== instanceId) {
    return setTimeout(becomeCandidate, getRandInRange(150, 300));
  }
  return null;
};

const startHeartbeat = (timer) => {
  if (timer) clearTimeout(timer);
  if (leaderId === instanceId) {
    pub.publish(
      serverChannel,
      JSON.stringify({ type: "IMTHELEADER", instanceId, electionTerm })
    );
    return setTimeout(startHeartbeat, 50);
  }
  return null;
};

const serverMsgValid = (msg) => "type" in msg; // TODO: flesh this out

serversub.on("message", (chn, origMsg) => {
  if (chn === serverChannel) {
    let msg = null;
    try {
      msg = JSON.parse(origMsg);
    } catch (e) {
      debug(e);
      return;
    }

    if (!serverMsgValid(msg)) return;

    //debug(msg);

    switch (msg.type) {
      case "WHOSTHELEADER":
        if (leaderId === instanceId) {
          // if someone asks, we'll just send the queued heartbeat now
          heartbeatTimer = startHeartbeat(heartbeatTimer);
        }
        break;
      case "IMTHELEADER": // also serves as heartbeat msg
        if (msg.electionTerm >= electionTerm && msg.instanceId !== instanceId) {
          leaderTimer = startLeaderTimer(leaderTimer);

          if (leaderId === instanceId) {
            // if we were leader
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            debug("hostile takeover:", msg.instanceId, msg.electionTerm);
          } else if (leaderId !== msg.instanceId)
            debug("new leader:", msg.instanceId, msg.electionTerm);

          leaderId = msg.instanceId;
          electionTerm = msg.electionTerm;
          hasVoted = false;
        } // else ignore old leaders and self
        break;
      case "VOTE4ME":
        debug(msg.instanceId, "asked for vote in term", msg.electionTerm);
        const newerTerm = msg.electionTerm > electionTerm;
        const currentTerm = msg.electionTerm === electionTerm;

        let vote = false;

        if (newerTerm) {
          // drop candidacy status and vote
          vote = true;
          amCandidate = false;
          electionTerm = msg.electionTerm;
          leaderTimer = startLeaderTimer(leaderTimer); // reset leader timer
        } else if (currentTerm) {
          if (amCandidate) {
            vote = msg.instanceId === instanceId;
          } else vote = !hasVoted;
        }

        pub.publish(
          serverChannel,
          JSON.stringify({
            type: "VOTE",
            instanceId,
            electionTerm,
            for: msg.instanceId,
            vote,
          })
        );

        hasVoted = true;
        if (vote) debug("voted for", msg.instanceId, "in term", electionTerm);

        break;
      case "VOTE":
        if (!amCandidate) break; // ignore votes if not candidate
        if (
          msg.electionTerm === electionTerm &&
          msg.for === instanceId &&
          msg.vote
        ) {
          voteCount++;
          debug(
            msg.instanceId,
            "voted for me in term",
            msg.electionTerm,
            voteCount,
            "votes out of",
            voterCount
          );
        }
        if (voteCount > voterCount / 2 && leaderId !== instanceId) {
          // if we received majority of votes from other servers and aren't already the leader, we're now the leader
          clearTimeout(leaderTimer);
          leaderTimer = null;
          leaderId = instanceId;
          hasVoted = false;
          amCandidate = false;
          heartbeatTimer = startHeartbeat(heartbeatTimer);
          debug("im the new leader");
        }
        break;
      case "SPLITTEST": // kill current leader and start concurrent elections among several of the remaining servers (not all) to test fault tolerance
        debug("split***************************************************");
        if (leaderId === instanceId) {
          process.exit();
        } else if (Math.random() > 0.3) {
          becomeCandidate();
        } else leaderTimer = startLeaderTimer(leaderTimer);
        break;
      case "KILLALL":
        process.exit();
        break;
      default:
        break;
    }
  }

  if (isDEBUG) pub.publish(chn + "_" + instanceId, origMsg); // forward messages to a debug channel. this is done to ensure only actual servers listen to the original channel (and not redis-client instances for example)
});

pub.publish(serverChannel, JSON.stringify({ type: "WHOSTHELEADER" }));

leaderTimer = startLeaderTimer(leaderTimer);

//let count = 0;
//io.engine.generateId = (req) => `custom:${count++}`; // does not work

io.on("connection", (socket) => {
  socket.uuid = nanoid();

  debug(`${socket.id} connected, uuid: ${socket.uuid}`);

  socket.on("HELLO", (data) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.HELLO, socket.uuid, data])
    ); //.then(listenerCount => console.log("no. listeners: ",listenerCount));
  });

  socket.on("DATA", (target, data) => {
    pub.publish(
      clientChannel,
      JSON.stringify([msgType.DATA, socket.uuid, target, data])
    ); //.then(listenerCount => console.log("no. listeners: ",listenerCount));
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
