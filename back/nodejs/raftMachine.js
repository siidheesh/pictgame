const {
  Machine,
  assign,
  actions,
  send,
  interpret,
  createMachine,
} = require("xstate");
const { nanoid } = require("nanoid");

const isDEBUG = process.env.NODE_ENV === "development" || true;
const instanceId = process.env.PORT || nanoid();
const clientChannel = process.env.CLIENT_CHN || "pictgame_clients";
let serverChannel = process.env.SERVER_CHN || "pictgame_servers";
const redisOpt = {
  host: "192.168.1.39",
  port: 6379,
  enableAutoPipelining: true,
};

const Redis = require("ioredis");

const pub = new Redis(redisOpt);
const clientsub = new Redis(redisOpt);
const serversub = new Redis(redisOpt);

const debug = isDEBUG ? console.log : () => {};

const getRandInRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

pub.on("error", debug);
serversub.on("error", debug);
serversub.subscribe(serverChannel);

const raftMachine = createMachine(
  {
    initial: "follower",
    context: {
      leader: "",
      instanceId: instanceId,
      voted: false,
      term: 0,
      votes: 0,
      voters: 0,
    },
    on: {
      IMTHELEADER: {
        target: "follower",
        cond: (context, event) =>
          event.instanceId !== context.instanceId &&
          event.term >= context.term,
      },
      SPLITTEST1: "startCandidacy",
      SPLITTEST2: "follower",
    },
    states: {
      follower: {
        on: {
          IMTHELEADER: {
            target: "follower",
            actions: assign({
              leader: (context, event) => event.instanceId,
              term: (context, event) => event.term,
            }),
          },
          VOTE4ME: [
            {
              target: "follower",
              actions: [
                "vote",
                assign({
                  voted: true,
                  term: (context, event) => event.term,
                }),
              ],
              cond: (context, event) =>
                event.term >= context.term && !context.voted,
            },
          ],
        },
        after: [
          {
            delay: (context, event) => getRandInRange(150, 300),
            target: "startCandidacy",
            actions: ["startNewTerm"],
          },
        ],
      },
      startCandidacy: {
        invoke: {
          src: "requestVote",
          onDone: [
            {
              target: "candidate",
              actions: assign({
                votes: 1,
                voters: (context, event) => event.data,
              }),
              cond: (context, event) => event.data > 1,
            },
            { target: "leader" },
          ],
          onrror: "follower",
        },
      },
      candidate: {
        on: {
          VOTE: [
            {
              target: "candidateReceivedVote",
              actions: "incrVotes",
              cond: (context, event) =>
                event.term === context.term &&
                event.for === context.instanceId,
            },
          ],
          VOTE4ME: [
            {
              target: "follower",
              actions: [
                "vote",
                assign({
                  voted: true,
                  term: (context, event) => event.term,
                }),
              ],
              cond: (context, event) => event.term > context.term,
            },
          ],
        },
        after: [
          //{ delay: (context, event) => 50, target: "startCandidacy" },
          {
            delay: (context, event) => getRandInRange(150, 300),
            target: "startCandidacy",
            actions: "startNewTerm",
          },
        ],
      },
      candidateReceivedVote: {
        always: [
          {
            target: "leader",
            cond: (context, event) => context.votes > context.voters / 2,
          },
          { target: "candidate" },
        ],
      },
      leader: {
        entry: ["sendHeartbeat"],
        after: {
          50: { target: "leader" },
        },
      },
    },
  },
  {
    services: {
      requestVote: (context, event) => { // this is a service because we'll use its return value as voter count
        debug("requesting vote for term", context.term);
        return pub.publish(
          serverChannel,
          JSON.stringify({
            type: "VOTE4ME",
            instanceId: context.instanceId,
            term: context.term,
          })
        );
      },
    },
    actions: {
      sendHeartbeat: (context, event) => {
        pub.publish(
          serverChannel,
          JSON.stringify({
            type: "IMTHELEADER",
            instanceId: context.instanceId,
            term: context.term,
          })
        );
      },
      vote: (context, event) => {
        pub.publish(
          serverChannel,
          JSON.stringify({
            type: "VOTE",
            instanceId: context.instanceId,
            term: event.term,
            for: event.instanceId,
          })
        );
      },
      startNewTerm: assign({
        term: (context, event) => context.term + 1,
      }),
      incrVotes: assign({ votes: (context, event) => context.votes + 1 }),
    },
  }
);

const raftService = interpret(raftMachine, { devTools: true })
  //.onEvent(debug)
  .start();

serversub.on("message", (chn, origMsg) => {
  if (chn === serverChannel) {
    let msg = null;
    try {
      msg = JSON.parse(origMsg);
    } catch (e) {
      debug(e);
      return;
    }

    if (!("type" in msg)) return;

    //console.log(msg);
    switch (msg.type) {
      case "IMTHELEADER":
        raftService.send("IMTHELEADER", {
          instanceId: msg.instanceId,
          term: msg.term,
        }); 
        if (msg.instanceId !== raftService.state.context.instanceId) {
         debug(msg.instanceId, "is the leader of term", msg.term);
        } else debug("i am the leader of term", msg.term);
        break;
      case "VOTE4ME":
        debug(msg.instanceId, "asked for vote in term", msg.term);
        raftService.send("VOTE4ME", {
          instanceId: msg.instanceId,
          term: msg.term,
        });
        
        break;
      case "VOTE":
        debug(msg.instanceId, "voted for",msg.for,"in term", msg.term);
        raftService.send("VOTE", {
          instanceId: msg.instanceId,
          term: msg.term,
          for: msg.for,
        });
        break;
      case "KILLALL":
        process.exit();
        break;
      case "KILLLEADER":
        if (raftService.state.matches("leader")) process.exit();
        break;
      case "SPLITTEST":
        if (raftService.state.matches("leader")) {
          process.exit();
        } else if (Math.random() >= 0.2) {
          raftService.send("SPLITTEST1"); // startCandidacy
        } else {
          raftService.send("SPLITTEST2"); // follower
        }
        break;
      default:
        break;
    }
  }
});
