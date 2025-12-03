const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '..', 'database.json');

function defaultDb() {
  return {
    users: {}, // telegramId -> { wallet, username, totalToday, totalAllTime, totalWithdrawn, lastDropDay }
    withdrawals: [], // pending withdrawal requests
    config: {
      priceUsd: Number(process.env.HBR_PRICE_USD || 0.00009628),
      intervalMin: Number(process.env.DROP_INTERVAL_MIN || 20),
      minHbr: Number(process.env.DROP_MIN_HBR || 20),
      maxHbr: Number(process.env.DROP_MAX_HBR || 80),
      maxDailyPerUser: Number(process.env.MAX_DAILY_HBR_PER_USER || 3000)
    }
  };
}

function ensure() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function write(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getUser(telegramId) {
  const db = read();
  return db.users[String(telegramId)] || null;
}

function setUser(telegramId, obj) {
  const db = read();
  db.users[String(telegramId)] = Object.assign(db.users[String(telegramId)] || { totalWithdrawn: 0 }, obj);
  write(db);
  return db.users[String(telegramId)];
}

function addWithdrawal(req) {
  const db = read();
  db.withdrawals.push(req);

  // já inicializa totalWithdrawn se não existir
  const user = db.users[String(req.telegramId)] || {};
  if (user.totalWithdrawn === undefined) user.totalWithdrawn = 0;
  write(db);
  return req;
}

// Função para marcar uma retirada como concluída (debitar do totalWithdrawn)
function completeWithdrawal(id) {
  const db = read();
  const idx = db.withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return null;

  const req = db.withdrawals[idx];
  const user = db.users[String(req.telegramId)];
  if (user) {
    user.totalWithdrawn = (user.totalWithdrawn || 0) + req.amount;
  }

  // remove do array de pendentes
  db.withdrawals.splice(idx, 1);
  write(db);
  return req;
}

function popWithdrawal(id) {
  const db = read();
  const idx = db.withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return null;
  const [r] = db.withdrawals.splice(idx, 1);
  write(db);
  return r;
}

function listWithdrawals() {
  const db = read();
  return db.withdrawals;
}

function updateConfig(cb) {
  const db = read();
  cb(db.config);
  write(db);
  return db.config;
}

module.exports = {
  ensure,
  read,
  write,
  getUser,
  setUser,
  addWithdrawal,
  completeWithdrawal,
  listWithdrawals,
  popWithdrawal,
  updateConfig,
  defaultDb
};
