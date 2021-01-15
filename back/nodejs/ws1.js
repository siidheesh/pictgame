const debug =
    process.env.NODE_ENV === "development" || true ? console.log : () => {};
const PORT = process.env.PORT || 5000;
const pictgameChannel = process.env.PICTGAME_CHN || "pictgame";
const redisOpt = {
    host: "192.168.1.39",
    port: 6379,
    enableAutoPipelining: true,
};

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const { nanoid } = require("nanoid");
const Redis = require("ioredis");

const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);

const msgType = Object.freeze({ HELLO: 1, DATA: 2 });

pub.on("error", debug);
sub.on("error", debug);

/*

client A emits HELLO => server publishes HELLO 
=> subs emit HELLO to their respective clients
=> interested clients contact A directly by emitting DATA to their server
=> A chooses one (if available) and they negotiate

TODO: 

replace this with a STUN/TURN server for webrtc p2p
add rate-limiting

*/

sub.subscribe(pictgameChannel);

const pubMsgIsValid = (msg) =>
    Array.isArray(msg) &&
    ((msg[0] === msgType.DATA && msg.length === 4) ||
        (msg[0] === msgType.HELLO && msg.length === 3));

sub.on("message", (chn, msg) => {
    //debug(chn, msg);

    if (chn === pictgameChannel) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            debug(e);
            return;
        }

        if (!pubMsgIsValid(msg)) return;

        switch (msg[0]) {
            case msgType.HELLO: // msg: [type, source, payload]
                io.emit("HELLO", [msg[1], msg[2]]);
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
});

//let count = 0;
//io.engine.generateId = (req) => `custom:${count++}`; // does not work

io.on("connection", (socket) => {
    socket.uuid = nanoid();

    debug(`${socket.id} connected, uuid: ${socket.uuid}`);

    socket.on("HELLO", (data) => {
        pub.publish(
            pictgameChannel,
            JSON.stringify([msgType.HELLO, socket.uuid, data])
        );
    });

    socket.on("DATA", (target, data) => {
        pub.publish(
            pictgameChannel,
            JSON.stringify([msgType.DATA, socket.uuid, target, data])
        );
    });
});

app.set("trust proxy", 1);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

http.listen(PORT, () => {
    console.log(`server listening on *:${PORT}`);
});
