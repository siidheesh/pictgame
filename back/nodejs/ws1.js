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

const redis = new Redis(redisOpt);
const pub = new Redis(redisOpt);
const sub = new Redis(redisOpt);

redis.on("error", debug);

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

sub.on("message", (chn, msg) => {
    //debug(chn, msg);

    if (chn === pictgameChannel) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            debug(e);
            return;
        }

        if (!msg || !("type" in msg && "source" in msg && "data" in msg))
            return;

        const res = {
            source: msg.source,
            data: msg.data,
        };

        switch (msg.type) {
            case "HELLO":
                io.emit("HELLO", res);
                break;
            case "DATA":
                if ("target" in msg) {
                    let found = false;
                    io.sockets.sockets.forEach((socket) => {
                        if (found) return;
                        if (socket && socket.uuid === msg.target) {
                            debug(`we have ${msg.target}, sending ${msg.type}`);
                            socket.emit("DATA", res);
                            found = true;
                        }
                    });
                }
                break;
            default:
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
            JSON.stringify({
                type: "HELLO",
                source: socket.uuid,
                data,
            })
        );
    });

    socket.on("DATA", (target, data) => {
        pub.publish(
            pictgameChannel,
            JSON.stringify({
                type: "DATA",
                source: socket.uuid,
                target,
                data,
            })
        );
    });

    socket.emit("hi", socket.uuid);
});

app.set("trust proxy", 1);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

http.listen(PORT, () => {
    console.log(`server listening on *:${PORT}`);
});
