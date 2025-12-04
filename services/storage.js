const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '..', 'database.json');

function defaultDb() {
  return {
    users: {}, // telegramId -> { wallet, username, totalToday, totalAllTime, totalWithdrawn, lastDropDay, blocked, suspicionCount, attempts:[] }
    withdrawals: [], // pending withdrawal requests {id,...,status: 'pending'|'paid'|'rejected'}
    logsPublic: [], // short public logs
    logsAdmin: [],  // detailed admin logs
    config: {
      priceUsd: Number(process.env.HBR_PRICE_USD || 0.00009628),
      intervalMin: Number(process.env.DROP_INTERVAL_MIN || 20),
      minHbr: Number(process.env.DROP_MIN_HBR || 5),
      maxHbr: Number(process.env.DROP_MAX_HBR || 20),
      maxDailyPerUser: Number(process.env.MAX_DAILY_HBR_PER_USER || 100),
      fraudMaxWithdrawalsPerHour: 3,
      autoBlockOnSuspicion: true
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
  const key = String(telegramId);
  db.users[key] = Object.assign(db.users[key] || { totalWithdrawn: 0, suspicionCount:0, attempts:[], blocked:false }, obj);
  write(db);
  return db.users[key];
}

function addWithdrawal(req) {
  const db = read();
  req.status = req.status || 'pending';
  db.withdrawals.push(req);

  // initialize user fields if missing
  const user = db.users[String(req.telegramId)] || {};
  if (user.totalWithdrawn === undefined) user.totalWithdrawn = 0;
  if (user.attempts === undefined) user.attempts = [];
  write(db);

  // admin log
  addAdminLog({ type: 'withdraw_request', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, createdAt: req.createdAt });
  return req;
}

function completeWithdrawal(id, adminId) {
  const db = read();
  const idx = db.withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return null;
  const req = db.withdrawals[idx];
  // mark paid
  req.status = 'paid';
  req.paidAt = new Date().toISOString();
  req.paidBy = adminId || null;
  // update user totalWithdrawn
  const user = db.users[String(req.telegramId)];
  if (user) {
    user.totalWithdrawn = (user.totalWithdrawn || 0) + req.amount;
  }
  // add logs
  addAdminLog({ type: 'withdraw_paid', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, paidBy: adminId, paidAt: req.paidAt });
  addPublicLog({ text: `✅ Saque pago: @${req.username} recebeu ${req.amount} HBR (wallet: ${req.wallet})` });
  // remove from pending list
  db.withdrawals.splice(idx,1);
  write(db);
  return req;
}

function rejectWithdrawal(id, adminId, reason) {
  const db = read();
  const idx = db.withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return null;
  const req = db.withdrawals[idx];
  req.status = 'rejected';
  req.rejectedAt = new Date().toISOString();
  req.rejectedBy = adminId || null;
  req.rejectedReason = reason || null;
  addAdminLog({ type: 'withdraw_rejected', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, rejectedBy: adminId, reason });
  // remove from pending
  db.withdrawals.splice(idx,1);
  write(db);
  return req;
}

function listWithdrawals() {
  const db = read();
  return db.withdrawals;
}

function popWithdrawal(id) {
  const db = read();
  const idx = db.withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return null;
  const [r] = db.withdrawals.splice(idx, 1);
  write(db);
  return r;
}

function updateConfig(cb) {
  const db = read();
  cb(db.config);
  write(db);
  return db.config;
}

// Logs
function addPublicLog(entry) {
  const db = read();
  const item = { id: String(Date.now()), ts: new Date().toISOString(), ...entry };
  db.logsPublic.unshift(item);
  db.logsPublic = db.logsPublic.slice(0,200);
  write(db);
  return item;
}

function addAdminLog(entry) {
  const db = read();
  const item = { id: String(Date.now()), ts: new Date().toISOString(), ...entry };
  db.logsAdmin.unshift(item);
  db.logsAdmin = db.logsAdmin.slice(0,1000);
  write(db);
  return item;
}

// Fraud detection utilities
function recordAttempt(telegramId, type) {
  const db = read();
  const key = String(telegramId);
  const now = Date.now();
  const user = db.users[key] = db.users[key] || { totalWithdrawn:0, suspicionCount:0, attempts:[], blocked:false };
  user.attempts = user.attempts || [];
  user.attempts.push({ type, ts: now });
  // trim attempts to last 24h
  user.attempts = user.attempts.filter(a => now - a.ts < 24*3600*1000);
  write(db);
  return user.attempts;
}

function countRecentAttempts(telegramId, withinMs) {
  const db = read();
  const user = db.users[String(telegramId)];
  if (!user || !user.attempts) return 0;
  const now = Date.now();
  return user.attempts.filter(a => now - a.ts <= withinMs).length;
}

function incrementSuspicion(telegramId) {
  const db = read();
  const user = db.users[String(telegramId)] = db.users[String(telegramId)] || { totalWithdrawn:0, suspicionCount:0, attempts:[], blocked:false };
  user.suspicionCount = (user.suspicionCount || 0) + 1;
  write(db);
  addAdminLog({ type: 'suspicion_increment', telegramId, newCount: user.suspicionCount });
  return user.suspicionCount;
}

function blockUser(telegramId, reason) {
  const db = read();
  const user = db.users[String(telegramId)] = db.users[String(telegramId)] || { totalWithdrawn:0, suspicionCount:0, attempts:[], blocked:false };
  user.blocked = true;
  write(db);
  addAdminLog({ type: 'user_blocked', telegramId, reason });
  addPublicLog({ text: `⚠️ Usuário @${user.username || telegramId} bloqueado por suspeita: ${reason}` });
  return user;
}

function isBlocked(telegramId) {
  const db = read();
  const user = db.users[String(telegramId)];
  return user && user.blocked;
}

// helper to find duplicate wallets
function findUsersByWallet(wallet) {
  const db = read();
  const rows = Object.entries(db.users).filter(([id,u]) => u && u.wallet && u.wallet.toLowerCase() === String(wallet).toLowerCase());
  return rows.map(r=>({ telegramId: r[0], ...r[1]}));
}

module.exports = {
  ensure, read, write, getUser, setUser,
  addWithdrawal, completeWithdrawal, rejectWithdrawal, listWithdrawals, popWithdrawal,
  updateConfig, defaultDb,
  addPublicLog, addAdminLog,
  recordAttempt, countRecentAttempts, incrementSuspicion, blockUser, isBlocked, findUsersByWallet
};
