// services/storage.js - PostgreSQL-backed storage
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION || null,
});

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS logs_public (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMP DEFAULT now(),
  text TEXT
);
CREATE TABLE IF NOT EXISTS logs_admin (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMP DEFAULT now(),
  data JSONB
);
CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY,
  telegram_id TEXT,
  type TEXT,
  ts BIGINT
);
CREATE TABLE IF NOT EXISTS drop_state (
  id INTEGER PRIMARY KEY,
  last_drop TIMESTAMP
);
INSERT INTO drop_state (id, last_drop)
VALUES (1, NOW() - INTERVAL '20 minutes')
ON CONFLICT (id) DO NOTHING;
`;

const DEFAULT_CONFIG = {
  priceUsd: Number(process.env.HBR_PRICE_USD || 0.00009628),
  intervalMin: Number(process.env.DROP_INTERVAL_MIN || 20),
  minHbr: Number(process.env.DROP_MIN_HBR || 5),
  maxHbr: Number(process.env.DROP_MAX_HBR || 20),
  maxDailyPerUser: Number(process.env.MAX_DAILY_HBR_PER_USER || 100),
  fraudMaxWithdrawalsPerHour: 3,
  autoBlockOnSuspicion: true,
  maxDailyRewardUsd: Number(process.env.MAX_DAILY_REWARD_USD || 1.0),
  totalDistributedTodayUsd: 0
};

async function ensure() {
  await pool.query(INIT_SQL);
  const res = await pool.query('SELECT value FROM config WHERE key=$1', ['main']);
  if (res.rowCount === 0) {
    await pool.query('INSERT INTO config(key,value) VALUES($1,$2)', ['main', DEFAULT_CONFIG]);
  }
}

// read returns an aggregated "db" object
async function read() {
  await ensure();
  const db = { users: {}, withdrawals: [], logsPublic: [], logsAdmin: [], config: {} };
  const cu = await pool.query('SELECT telegram_id,data FROM users');
  cu.rows.forEach(r => { db.users[r.telegram_id] = r.data; });
  const cw = await pool.query('SELECT id,data FROM withdrawals ORDER BY id');
  cw.rows.forEach(r => db.withdrawals.push(r.data));
  const lp = await pool.query('SELECT ts,text FROM logs_public ORDER BY id DESC LIMIT 200');
  lp.rows.forEach(r => db.logsPublic.push({ ts: r.ts, text: r.text }));
  const la = await pool.query('SELECT ts,data FROM logs_admin ORDER BY id DESC LIMIT 1000');
  la.rows.forEach(r => db.logsAdmin.push({ ts: r.ts, ...r.data }));
  const cfg = await pool.query('SELECT value FROM config WHERE key=$1', ['main']);
  db.config = cfg.rows[0] ? cfg.rows[0].value : DEFAULT_CONFIG;
  return db;
}

async function writeDb(obj) {
  if (obj.config) {
    await pool.query('UPDATE config SET value=$1 WHERE key=$2', [obj.config, 'main']);
  }
  return true;
}

async function getUser(telegramId) {
  const res = await pool.query('SELECT data FROM users WHERE telegram_id=$1', [String(telegramId)]);
  return res.rowCount ? res.rows[0].data : null;
}

async function setUser(telegramId, obj) {
  const key = String(telegramId);
  const existing = await getUser(key) || {};
  const merged = Object.assign({}, existing, obj);
  await pool.query('INSERT INTO users(telegram_id,data) VALUES($1,$2) ON CONFLICT (telegram_id) DO UPDATE SET data = $2', [key, merged]);
  return merged;
}

async function unblockUser(telegramId) {
  const key = String(telegramId);
  const user = await getUser(key);
  if (!user) return null;
  user.blocked = false;
  await setUser(key, user);
  await addAdminLog({ type:'admin_unblock', telegramId, ts: new Date().toISOString() });
  return user;
}

async function addWithdrawal(req) {
  await pool.query('INSERT INTO withdrawals(id,data) VALUES($1,$2)', [req.id, req]);
  const user = await getUser(req.telegramId) || {};
  if (user.totalWithdrawn === undefined) user.totalWithdrawn = 0;
  if (!Array.isArray(user.attempts)) user.attempts = [];
  await setUser(req.telegramId, user);
  await addAdminLog({ type: 'withdraw_request', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, createdAt: req.createdAt });
  return req;
}

async function completeWithdrawal(id, adminId) {
  const r = await pool.query('SELECT data FROM withdrawals WHERE id=$1', [id]);
  if (!r.rowCount) return null;
  const req = r.rows[0].data;
  req.status = 'paid';
  req.paidAt = new Date().toISOString();
  req.paidBy = adminId || null;
  const user = await getUser(req.telegramId);
  if (user) {
    user.totalWithdrawn = (user.totalWithdrawn || 0) + req.amount;
    await setUser(req.telegramId, user);
  }
  await addAdminLog({ type: 'withdraw_paid', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, paidBy: adminId, paidAt: req.paidAt });
  await addPublicLog(`✅ Saque pago: @${req.username || req.telegramId} recebeu ${req.amount} HBR (wallet: ${req.wallet})`);
  await pool.query('DELETE FROM withdrawals WHERE id=$1', [id]);
  return req;
}

async function rejectWithdrawal(id, adminId, reason) {
  const r = await pool.query('SELECT data FROM withdrawals WHERE id=$1', [id]);
  if (!r.rowCount) return null;
  const req = r.rows[0].data;
  req.status = 'rejected';
  req.rejectedAt = new Date().toISOString();
  req.rejectedBy = adminId || null;
  req.rejectedReason = reason || null;
  await addAdminLog({ type: 'withdraw_rejected', id: req.id, telegramId: req.telegramId, username: req.username, amount: req.amount, wallet: req.wallet, rejectedBy: adminId, reason });
  await pool.query('DELETE FROM withdrawals WHERE id=$1', [id]);
  return req;
}

async function listWithdrawals() {
  const r = await pool.query('SELECT data FROM withdrawals ORDER BY id');
  return r.rows.map(r=>r.data);
}

async function popWithdrawal(id) {
  const r = await pool.query('SELECT data FROM withdrawals WHERE id=$1', [id]);
  if (!r.rowCount) return null;
  const req = r.rows[0].data;
  await pool.query('DELETE FROM withdrawals WHERE id=$1', [id]);
  return req;
}

async function updateConfig(cb) {
  const cur = (await pool.query('SELECT value FROM config WHERE key=$1', ['main'])).rows[0].value;
  const copy = Object.assign({}, cur);
  cb(copy);
  await pool.query('UPDATE config SET value=$1 WHERE key=$2', [copy, 'main']);
  return copy;
}

async function addPublicLog(text) {
  await pool.query('INSERT INTO logs_public(text) VALUES($1)', [text]);
  return true;
}

async function addAdminLog(entry) {
  await pool.query('INSERT INTO logs_admin(data) VALUES($1)', [entry]);
  return true;
}

async function recordAttempt(telegramId, type) {
  const now = Date.now();
  await pool.query('INSERT INTO attempts(telegram_id,type,ts) VALUES($1,$2,$3)', [String(telegramId), type, now]);
  await pool.query('DELETE FROM attempts WHERE ts < $1', [now - 24*3600*1000]);
  return true;
}

async function countRecentAttempts(telegramId, withinMs) {
  const now = Date.now();
  const r = await pool.query('SELECT count(*) FROM attempts WHERE telegram_id=$1 AND ts >= $2', [String(telegramId), now - withinMs]);
  return Number(r.rows[0].count || 0);
}

async function incrementSuspicion(telegramId) {
  const user = await getUser(telegramId) || {};
  user.suspicionCount = (user.suspicionCount || 0) + 1;
  await setUser(telegramId, user);
  await addAdminLog({ type:'suspicion_increment', telegramId, newCount: user.suspicionCount });
  return user.suspicionCount;
}

async function blockUser(telegramId, reason) {
  const user = await getUser(telegramId) || {};
  user.blocked = true;
  await setUser(telegramId, user);
  await addAdminLog({ type:'user_blocked', telegramId, reason });
  await addPublicLog(`⚠️ Usuário @${user.username || telegramId} bloqueado por suspeita: ${reason}`);
  return user;
}

async function isBlocked(telegramId) {
  const user = await getUser(telegramId);
  return user && user.blocked;
}

async function findUsersByWallet(wallet) {
  const r = await pool.query('SELECT telegram_id,data FROM users WHERE (data->>\'wallet\') ILIKE $1', [String(wallet).toLowerCase()]);
  return r.rows.map(r=>({ telegramId: r.telegram_id, ...r.data }));
}

async function resetDailyTotals() {
  const dbRes = await pool.query('SELECT value FROM config WHERE key=$1', ['main']);
  const dbcfg = dbRes.rows[0] ? dbRes.rows[0].value : DEFAULT_CONFIG;
  const today = Math.floor(Date.now()/(24*3600));
  const users = (await pool.query('SELECT telegram_id,data FROM users')).rows;
  for (const r of users) {
    const u = r.data;
    u.totalToday = 0;
    u.lastDropDay = today;
    await pool.query('UPDATE users SET data=$1 WHERE telegram_id=$2', [u, r.telegram_id]);
  }
  dbcfg.totalDistributedTodayUsd = 0;
  await pool.query('UPDATE config SET value=$1 WHERE key=$2', [dbcfg, 'main']);
  await addAdminLog({ type:'daily_reset', ts: new Date().toISOString() });
  return true;
}

async function addDistributedUsd(value) {
  const res = await pool.query('SELECT value FROM config WHERE key=$1', ['main']);
  const cfg = res.rows[0].value;
  cfg.totalDistributedTodayUsd = (cfg.totalDistributedTodayUsd || 0) + Number(value || 0);
  await pool.query('UPDATE config SET value=$1 WHERE key=$2', [cfg, 'main']);
  return cfg.totalDistributedTodayUsd;
}

async function getConfig() {
  const res = await pool.query('SELECT value FROM config WHERE key=$1', ['main']);
  return res.rows[0] ? res.rows[0].value : DEFAULT_CONFIG;
}

module.exports = {
  ensure, read, writeDb, getUser, setUser, unblockUser,
  addWithdrawal, completeWithdrawal, rejectWithdrawal, listWithdrawals, popWithdrawal,
  updateConfig, addPublicLog, addAdminLog, recordAttempt, countRecentAttempts, incrementSuspicion, blockUser, isBlocked, findUsersByWallet,
  resetDailyTotals, addDistributedUsd, getConfig
};
