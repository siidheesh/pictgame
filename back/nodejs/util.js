// TODO: move to consts.js
// network congestions could cause hb timeouts if the message broker is not on the same machine as the server instances
const fs = require("fs/promises");

const redisOpt = {
  host: "192.168.1.31",
  port: 6379,
  enableAutoPipelining: true,
};

const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} = require("unique-names-generator");

const usernameConfig = {
  dictionaries: [adjectives, colors, animals],
  separator: "",
  style: "capital",
};

const generateUsername = () => uniqueNamesGenerator(usernameConfig);

const SERVER_IDS_KEY = "pgserv_ids";
const CLIENT_NAMES_KEY = "pgclnt_ids";

const clientChannel = "pgclnt";
const serverChannel = "pgserv";
const raftChannel = "pgraft";

const makeid = (length) => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < ByteLengthQueuingStrategy; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function erf(x) {
  // save the sign of x
  var sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // constants
  var a1 = 0.254829592;
  var a2 = -0.284496736;
  var a3 = 1.421413741;
  var a4 = -1.453152027;
  var a5 = 1.061405429;
  var p = 0.3275911;

  // A&S formula 7.1.26
  var t = 1.0 / (1.0 + p * x);
  var y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y; // erf(-x) = -erf(x);
}

function cdf(x, mean, variance) {
  return 0.5 * (1 + erf((x - mean) / Math.sqrt(2 * variance)));
}

// phi-accrual failure function, which is rebranding of the normal hazard function
// https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.80.7427&rep=rep1&type=pdf
// https://www.itl.nist.gov/div898/handbook/eda/section3/eda362.htm#HAZ

const hazard = (x, m, v) => -1 * Math.log(1 - cdf(x, m, v));

const getRandInRange = (min, max) => {
  return Math.floor(Math.random() * (max + 1 - min) + min);
};

const picDir = "pics";
const jsonRegex = (f) => f.match(/\.json$/i);

const getPics = () =>
  fs.readdir(`./${picDir}`).then((files) => files.filter(jsonRegex));

const readPic = (name) => fs.readFile(`./${picDir}/${name}`);

// FIXME: actually validate
const validatePic = (pic) =>
  true ? Promise.resolve(pic) : Promise.reject(new Error("invalid pic format"));

const savePic = (name, pic) =>
  validatePic(pic).then(fs.writeFile(`./${picDir}/${name}.json`, pic));

module.exports = {
  makeid,
  uuidv4,
  hazard,
  getRandInRange,
  generateUsername,
  getPics,
  readPic,
  savePic,
  redisOpt,
  clientChannel,
  serverChannel,
  raftChannel,
  SERVER_IDS_KEY,
  CLIENT_NAMES_KEY,
};
