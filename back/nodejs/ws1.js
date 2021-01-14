const debug =
    process.env.NODE_ENV === "development" || true ? console.log : () => {};
const PORT = process.env.PORT || 5000;
const pictgameChn = process.env.PICTGAME_CHN || pictgameChn;
const serverId = process.env.SERVERID ? `pgn_${process.env.SERVERID}` : "pgn_1";
const redisOpt = {
    host: "192.168.1.39",
    port: 6379,
    enableAutoPipelining: true,
};

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const IORedis = require("ioredis");
const Redis = require("ioredis");
const redis = new Redis(redisOpt);
const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);

redis.on("error", debug);

/*

client A emits SCAN => server pubs SCAN 
=> subs emit SCAN to clients (orig sender ignores by checking clientId) 
=> interested clients emit HELLO
=> subs recv HELLO, emit HELLO to its clients 
=> client A emits MATCHREQ and its public key to B
=> client B, if it accepts, emits MATCHOK with its public key to A
=> DH kex done, both generate shared secret for enc/dec

ideally server should relay communications between them now, but how?

client A emits DATA cipertext to targetId
=> server pubs DATA, sourceId, targetId
=> sub with client B sends cipertext to it
=> Client B decrypts DATA and acts on it
(repeat as needed)

*/

sub.subscribe(pictgameChn);

const rooms = new Set();

sub.on("message", async (chn, msg) => {
    debug(chn, msg);
    if (chn == pictgameChn) {

        msg = JSON.parse(msg);

        if (!msg || !("type" in msg)) return;

        const ids = await io.allSockets();

        debug(ids);

        switch (msg.type) {
            case "SCAN":
                io.emit("SCAN", {
                    sourceId: msg.sourceId,
                    sourceData: msg.sourceData,
                });
                break;
            case "HELLO":
                if (ids.has(msg.targetId)) {
                    debug(`we have ${msg.targetId}, sending HELLO`);
                    io.to(msg.targetId).emit("HELLO", {
                        sourceId: msg.sourceId,
                        sourceData: msg.sourceData,
                    });
                } else debug("not for us");
                break;
            case "MATCHREQ": // TODO: remove these as we only need DATA, let clients negotiate
            case "MATCHOK":
                if (ids.has(msg.targetId)) {
                    debug(`we have ${msg.targetId}, sending ${msg.type}`);
                    io.to(msg.targetId).emit(msg.type, {
                        sourceId: msg.sourceId,
                        publicKey: msg.publicKey, //each side sends their public key
                    });
                } else debug("not for us");
                break;
            case "DATA":
                // TODO: find way to check auth (current soln: dh kex and cipertext)
                if (ids.has(msg.targetId)) {
                    debug(`we have ${msg.targetId}, sending ${msg.type}`);
                    io.to(msg.targetId).emit("DATA", {
                        sourceId: msg.sourceId,
                        data: msg.data, // cipertext as hex
                    });
                } else debug("not for us");
            case "DISCONNECT":
            default:
                break;
        }
    }
});
io.on("connection", async (socket) => {
    // TODO: generate uuid, assign to socket.uuid and use that instead of socket.id
    debug(`${socket.id} connected`);

    socket.emit(`you are ${socket.id}`);

    socket.on("SCAN", (data) => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "SCAN",
                sourceId: socket.id,
                sourceData: data,
            })
        );
    });

    socket.on("HELLO", (targetId, data) => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "HELLO",
                targetId,
                sourceId: socket.id,
                sourceData: data,
            })
        );
    });

    socket.on("MATCHREQ", (targetId) => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "MATCHREQ",
                sourceId: socket.id,
                targetId,
            })
        );
    });

    socket.on("MATCHOK", (targetId) => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "MATCHOK",
                sourceId: socket.id,
                targetId,
            })
        );
    });

    socket.on("DATA", (targetId, data) => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "DATA",
                sourceId: socket.id,
                targetId,
                data,
            })
        );
        //io.to(targetId).emit('DATA', data);
    });

    socket.on("disconnect", () => {
        pub.publish(
            pictgameChn,
            JSON.stringify({
                type: "DISCONNECT",
                sourceId: socket.id,
                matchId: socket.matchId,
            })
        );
    });
});

app.set("trust proxy", 1);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

http.listen(PORT, () => {
    console.log(`server ${serverId} listening on *:${PORT}`);
});
