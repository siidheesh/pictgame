/*
  Consensus algorithm adapted from the Raft algo
  Used to reach a consensus among server instances on who (leaderId) the matchmaker is

  Extreme case 1: all instances agree on the same leaderId, client matchmaking takes places across all instances
  Extreme case 2: each instance is decoupled from everyone else and is its own leader, and matchmakes within its own clients

  TODO: refactor into sep. module (done)
*/
const isDEBUG = process.env.NODE_ENV === "development" || true;
const debug = isDEBUG ? console.log : () => {};
const chalk = require("chalk");

const { createMachine, assign, actions, interpret } = require("xstate");
const { choose } = actions;

const { hazard, getRandInRange, redisOpt, raftChannel } = require("./util");

module.exports = (id, pub, onLeaderChange = () => {}) => {
  const raftMachine = createMachine(
    {
      initial: "follower",
      context: {
        leader: "",
        instanceId: id,
        term: 0,
        votes: 0,
        voters: 0,
        // heartbeat phi-accrual failure detection
        hbPhi: 8,
        hbLastArrival: 0,
        hbCount: 0,
        hbMean: 0,
        hbVariance: 0,
      },
      on: {
        IMTHELEADER: {
          cond: "newerLeader",
          target: "follower",
          actions: ["leaderAssign", onLeaderChange],
        },
        // these two are for testing
        BECOME_CANDIDATE: "startCandidacy",
        BECOME_FOLLOWER: "follower",
      },
      states: {
        follower: {
          on: {
            IMTHELEADER: {
              target: "follower",
              actions: choose([
                {
                  cond: "leaderChanged",
                  actions: ["leaderAssign", onLeaderChange],
                },
                { actions: "updateHbParameters" },
              ]),
            },
            VOTE4ME: [
              {
                cond: "newerTerm",
                target: "follower",
                actions: ["vote", "setVoted"],
              },
            ],
          },
          after: [
            /*{
            cond: "overPhiThreshold",
            delay: "phiTimeout",
            target: "startCandidacy",
          },*/
            {
              delay: "electionTimeout",
              target: "startCandidacy",
            },
          ],
        },
        startCandidacy: {
          entry: "startNewTerm",
          invoke: {
            src: "requestVote",
            onDone: [
              {
                cond: "notAlone",
                target: "candidate",
                actions: "initVotes",
              },
              {
                target: "leader",
                actions: ["leaderAssignSelf", onLeaderChange],
              },
            ],
          },
        },
        candidate: {
          on: {
            VOTE: [
              {
                cond: "voteIsValid",
                target: "candidateReceivedVote",
                actions: "incrementVotes",
              },
            ],
            VOTE4ME: [
              {
                cond: "newerTerm",
                target: "follower",
                actions: ["vote", "setVoted"],
              },
            ],
          },
          after: [
            {
              delay: "electionTimeout",
              target: "startCandidacy",
            },
          ],
        },
        candidateReceivedVote: {
          always: [
            {
              cond: "majorityAchieved",
              target: "leader",
              actions: ["leaderAssignSelf", onLeaderChange],
            },
            { target: "candidate" },
          ],
        },
        leader: {
          entry: "sendHeartbeat",
          after: {
            hbPeriod: { target: "leader" },
          },
        },
      },
    },
    {
      guards: {
        newerLeader: (context, event) =>
          event.instanceId !== context.instanceId && event.term >= context.term,
        leaderChanged: (context, event) => context.leader !== event.instanceId,
        notAlone: (context, event) => event.data > 1,
        newerTerm: (context, event) => event.term > context.term,
        voteIsValid: (context, event) =>
          event.term === context.term && event.for === context.instanceId,
        majorityAchieved: (context, event) =>
          context.votes > context.voters / 2,
        overPhiThreshold: (context, event) => {
          if (context.leader === "" || context.hbCount) return true;
          //debug("hazard",context.hbCount, (Date.now() - context.hbLastArrival), context.hbMean, context.hbVariance**0.5);
          const phiRes = hazard(
            Date.now() - context.hbLastArrival,
            context.hbMean,
            context.hbVariance
          );
          const isOverPhi = context.hbCount ? phiRes > context.hbPhi : true;
          if (isOverPhi) debug(`${phiRes} is over phi ${context.hbPhi}`);
          return isOverPhi;
        },
      },
      services: {
        requestVote: (context, event) => {
          // this is a service because we'll use its resolved promise as voter count
          debug(chalk.red.bold("requesting vote for term", context.term));
          return pub.publish(
            raftChannel,
            JSON.stringify({
              type: "VOTE4ME",
              instanceId: context.instanceId,
              term: context.term,
            })
          );
        },
      },
      delays: {
        electionTimeout: (context, event) => getRandInRange(150, 300),
        //phiTimeout: 10 // needs to be carefully selected: too low and itll keep timing out, too high and electionTimeout might occur
        hbPeriod: 50,
      },
      actions: {
        sendHeartbeat: (context, event) => {
          pub.publish(
            raftChannel,
            JSON.stringify({
              type: "IMTHELEADER",
              instanceId: context.instanceId,
              term: context.term,
            })
          );
        },
        vote: (context, event) => {
          pub.publish(
            raftChannel,
            JSON.stringify({
              type: "VOTE",
              instanceId: context.instanceId,
              term: event.term,
              for: event.instanceId,
            })
          );
        },
        setVoted: assign({
          // we don't need context.voted because we'll only ever vote in newer terms
          term: (context, event) => event.term,
        }),
        startNewTerm: assign({
          leader: "",
          term: (context, event) => {
            debug(
              chalk.red.bold("*****GAP:", Date.now() - context.hbLastArrival)
            );
            return context.term + 1;
          },
        }),
        initVotes: assign({
          votes: 1, // each candidate votes for itself
          voters: (context, event) => event.data,
        }),
        incrementVotes: assign({
          votes: (context, event) => context.votes + 1,
        }),
        leaderAssignSelf: assign({
          leader: (context, event) => context.instanceId,
        }),
        leaderAssign: assign({
          voted: false,
          leader: (context, event) => event.instanceId,
          term: (context, event) => event.term,
          hbLastArrival: (_) => Date.now(),
          hbCount: 0,
        }),
        updateHbParameters: assign({
          // hbMean and hbVariance are MLE estimators, assuming hb inter-arrival time is normal (as per the CLT)
          hbLastArrival: (context, event) => Date.now(),
          hbCount: (context, event) => context.hbCount + 1,
          hbMean: (context, event) =>
            (context.hbCount * context.hbMean +
              (Date.now() - context.hbLastArrival)) /
            (context.hbCount + 1),
          hbVariance: (context, event) =>
            (context.hbCount * context.hbVariance +
              (Date.now() -
                context.hbLastArrival -
                (context.hbCount * context.hbMean +
                  (Date.now() - context.hbLastArrival)) /
                  (context.hbCount + 1)) **
                2) /
            (context.hbCount + 1),
        }),
      },
    }
  );

  const raftService = interpret(raftMachine).start();

  const imTheLeader = () => raftService.state.matches("leader");
  const getLeader = () => raftService.state.context.leader;

  let prevLeader = "";

  const processRaftMsg = (origMsg) => {
    let msg = null;
    try {
      msg = JSON.parse(origMsg);
    } catch (e) {
      debug(e);
      return;
    }

    if (!("type" in msg)) return;

    switch (msg.type) {
      case "IMTHELEADER":
        if ("instanceId" in msg && "term" in msg) {
          raftService.send("IMTHELEADER", {
            instanceId: msg.instanceId,
            term: msg.term,
          });

          /*if (raftService.state.context.hbMean > maxHbMean)
            maxHbMean = raftService.state.context.hbMean;
          debug(
            raftService.state.context.hbCount,
            maxHbMean,
            raftService.state.context.hbVariance
          );*/

          if (prevLeader === msg.instanceId) break;
          prevLeader = msg.instanceId;

          if (msg.instanceId !== raftService.state.context.instanceId) {
            debug(
              chalk.green.bold(
                msg.instanceId,
                "is the leader of term",
                msg.term
              )
            );
          } else debug(chalk.green.bold("i am the leader of term", msg.term));
        }
        break;
      case "VOTE4ME":
        if ("instanceId" in msg && "term" in msg) {
          //debug(msg.instanceId, "asked for vote in term", msg.term);
          raftService.send("VOTE4ME", {
            instanceId: msg.instanceId,
            term: msg.term,
          });
        }
        break;
      case "VOTE":
        if (
          "instanceId" in msg &&
          "term" in msg &&
          "for" in msg &&
          msg.for === raftService.state.context.instanceId
        ) {
          /*debug(
            chalk.green.bold(
              msg.instanceId,
              "voted for",
              msg.for,
              "in term",
              msg.term
            )
          );*/
          raftService.send("VOTE", {
            instanceId: msg.instanceId,
            term: msg.term,
            for: msg.for,
          });
        }
        break;
      case "KILLALL":
        process.exit();
        break;
      case "KILLLEADER":
        if (imTheLeader()) process.exit();
        break;
      case "SPLITTEST": // test split votes and fault tolerance
        debug(chalk.bold("*******split*******"));
        if (imTheLeader()) {
          process.exit();
        } else if (Math.random() > Math.random()) {
          // get a random proportion
          debug("candidate");
          raftService.send("BECOME_CANDIDATE"); // startCandidacy
        } else {
          debug("follower");
          raftService.send("BECOME_FOLLOWER"); // follower
        }
        break;
      default:
        break;
    }
  };

  return { raftService, processRaftMsg, imTheLeader, getLeader };
};

//module.exports =
