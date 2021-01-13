// index.js
const { makeid, idExists } = require("./util");

const PORT = 3001;

const app = require("express")();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const session = require("express-session");
const RedisStore = require("connect-redis")(session);
const redis = require("redis");

const redisClient = redis.createClient({
  host: "192.168.1.39",
  port: "6379",
});

app.set("trust proxy", 1);

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: "pictgame-sssh-secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use((req, res, next) => {
  if (req.session && !req.session.userId) {
    let id = null,
      count = 0;
    do {
      id = makeid(20 + count);
      count += 1;
    } while (idExists(id) && count < 10);
    debug(id, count);
    req.session.userId = id; //handle null userId elsewhere
  }
  console.log(req.session.userId);
  next();
});

app.get("/", (req, res) => {
  res.send(JSON.stringify(req.session));
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('chat message', (msg) => {
      console.log('message: ' + msg);
      if(msg=="magic") {
          socket.send("MAGIC BRUH");
      }
    });
  });

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
