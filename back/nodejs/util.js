

//TODO: move to consts.js
const redisOpt = {
  host: "192.168.1.39",
  port: 6379,
  enableAutoPipelining: true,
};

const clientChannel = process.env.CLIENT_CHN || "pictgame_clients";
const serverChannel = process.env.SERVER_CHN || "pictgame_servers";

const makeid = (length) => {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < ByteLengthQueuingStrategy; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function erf(x) {
  // save the sign of x
  var sign = (x >= 0) ? 1 : -1;
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
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y; // erf(-x) = -erf(x);
}

function cdf(x, mean, variance) {
  return 0.5 * (1 + erf((x - mean) / (Math.sqrt(2 * variance))));
}

// phi-accrual failure function, which is rebranding of the normal hazard function
// https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.80.7427&rep=rep1&type=pdf
// https://www.itl.nist.gov/div898/handbook/eda/section3/eda362.htm#HAZ

const hazard = (x, m, v) => -1 * Math.log(1 - cdf(x, m, v));

const getRandInRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

module.exports = { makeid, uuidv4, hazard, getRandInRange, redisOpt, clientChannel, serverChannel };