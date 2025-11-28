// utils/limits.js
const fs = require("fs");
const path = require("path");
const LIMITS_FILE = path.resolve("./data/limits.json");

function loadLimits() {
  if (!fs.existsSync(LIMITS_FILE)) return {};
  return JSON.parse(fs.readFileSync(LIMITS_FILE));
}
function saveLimits(data) {
  fs.writeFileSync(LIMITS_FILE, JSON.stringify(data, null, 2));
}

// canReceive(userId) -> verifica se usuário ainda não atingiu limite diário
function canReceive(userId) {
  const data = loadLimits();
  const today = new Date().toISOString().slice(0, 10);
  if (!data[userId]) data[userId] = {};
  if (!data[userId][today]) data[userId][today] = 0;
  const max = Number(process.env.MAX_DROPS_PER_DAY || 3);
  return data[userId][today] < max;
}

function increment(userId) {
  const data = loadLimits();
  const today = new Date().toISOString().slice(0, 10);
  if (!data[userId]) data[userId] = {};
  if (!data[userId][today]) data[userId][today] = 0;
  data[userId][today] += 1;
  saveLimits(data);
}

module.exports = { canReceive, increment };
