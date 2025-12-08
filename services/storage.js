// services/storage.js
// PostgreSQL COMPLETE STORAGE for HueHueBR Drop Bot

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

/* ======================================================================
   DATABASE INIT
====================================================================== */

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
  ts TIMESTAMP DEFAULT NOW(),
  text TEXT
);

CREATE TABLE IF NOT EXISTS logs_admin (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMP DEFAULT NOW(),
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

INSERT INTO drop_state(id,last_drop)
VALUES(1, NOW() - INTERVAL '20 minutes')
ON CONFLICT(id) DO NOTHING;

`;

const DEFAULT_CONFIG = {
  priceUsd: 0.0001,
  intervalMin: 20,
  minHbr: 5,
  maxHbr: 20,
  maxDailyPerUser: 100,
  fraudMaxWithdrawalsPerHour: 3,
  autoBlockOnSuspicion: true,
  maxDailyRewardUsd: 1.0,
  totalDistributedTodayUsd: 0
};

/* ======================================================================
   INIT
====================================================================== */

async function ensure() {
  await pool.query(INIT_SQL);

  const res = await pool.query(
    `SELECT value FROM config WHERE key='main'`
  );

  if (res.rowCount === 0) {
    await pool.query(
      `INSERT INTO config(key,value) VALUES('main',$1)`,
      [DEFAULT_CONFIG]
    );
  }
}

/* ======================================================================
   USER NORMALIZATION
====================================================================== */

function normalizeUser(u = {}) {
  return {
    wallet: u.wallet || null,
    username: u.username || null,
    balance: typeof u.balance === "number" ? u.balance : 0,
    totalToday: typeof u.totalToday === "number" ? u.totalToday : 0,
    totalAllTime: typeof u.totalAllTime === "number" ? u.totalAllTime : 0,
    totalWithdrawn: typeof u.totalWithdrawn === "number" ? u.totalWithdrawn : 0,
    blocked: u.blocked === true,
    attempts: Array.isArray(u.attempts) ? u.attempts : [],
    suspicionCount: typeof u.suspicionCount === "number" ? u.suspicionCount : 0,
    registeredAt: u.registeredAt || null
  };
}

/* ======================================================================
   READ FULL DB
====================================================================== */

async function read() {
  const db = { users: {} };

  const users = await pool.query(
    `SELECT telegram_id,data FROM users`
  );

  users.rows.forEach(r => {
    db.users[r.telegram_id] = normalizeUser(r.data);
  });

  const cfg = await getConfig();
  db.config = cfg;

  return db;
}

/* ======================================================================
   CONFIG
====================================================================== */

async function getConfig() {
  const res = await pool.query(
    `SELECT value FROM config WHERE key='main'`
  );
  return res.rows[0] ? res.rows[0].value : DEFAULT_CONFIG;
}

async function updateConfig(cb) {
  const cfg = await getConfig();
  const updated = { ...cfg };
  cb(updated);
  await pool.query(
    `UPDATE config SET value=$1 WHERE key='main'`,
    [updated]
  );
  return updated;
}

/* ======================================================================
   USERS
====================================================================== */

async function getUser(telegramId) {
  const res = await pool.query(
    `SELECT data FROM users WHERE telegram_id=$1`,
    [String(telegramId)]
  );
  return res.rows.length ? normalizeUser(res.rows[0].data) : null;
}

async function setUser(telegramId, obj) {
  const key = String(telegramId);
  let existing = await getUser(key);
  if (!existing) existing = normalizeUser({});

  const merged = normalizeUser({
    ...existing,
    ...obj
  });

  await pool.query(
    `
    INSERT INTO users(telegram_id,data)
    VALUES($1,$2)
    ON CONFLICT(telegram_id)
    DO UPDATE SET data=$2
  `,
    [key, merged]
  );

  return merged;
}

/* ======================================================================
   BLOCK / SUSPICIOUS
====================================================================== */

async function isBlocked(telegramId) {
  const u = await getUser(telegramId);
  return u && u.blocked;
}

async function blockUser(telegramId, reason) {
  const key = String(telegramId);
  const u = await getUser(key) || {};

  u.blocked = true;

  await setUser(key, u);
  await addAdminLog({ type: "block", telegramId, reason });

  return u;
}

async function unblockUser(telegramId) {
  const key = String(telegramId);
  const u = await getUser(key);
  if (!u) return null;

  u.blocked = false;
  await setUser(key, u);
  await addAdminLog({ type: "unblock", telegramId });

  return u;
}

/* ======================================================================
   ATTEMPTS / FRAUD DETECTION
====================================================================== */

async function recordAttempt(telegramId, type) {
  const now = Date.now();
  await pool.query(
    `
    INSERT INTO attempts(telegram_id,type,ts)
    VALUES($1,$2,$3)
  `,
    [String(telegramId), type, now]
  );

  await pool.query(
    `DELETE FROM attempts WHERE ts < $1`,
    [now - 24 * 3600 * 1000]
  );

  return true;
}

async function countRecentAttempts(telegramId, withinMs) {
  const now = Date.now();

  const res = await pool.query(
    `
    SELECT count(*) 
    FROM attempts 
    WHERE telegram_id=$1 
    AND ts >= $2
  `,
    [String(telegramId), now - withinMs]
  );

  return Number(res.rows[0].count || 0);
}

/* ======================================================================
   SEARCH
====================================================================== */

async function findUsersByWallet(wallet) {
  const res = await pool.query(
    `
    SELECT telegram_id,data 
    FROM users
    WHERE (data->>'wallet') ILIKE $1
  `,
    [String(wallet).toLowerCase()]
  );

  return res.rows.map(r => ({
    telegramId: r.telegram_id,
    ...r.data
  }));
}

/* ======================================================================
   WITHDRAWALS
====================================================================== */

async function addWithdrawal(req) {
  await pool.query(
    `INSERT INTO withdrawals(id,data) VALUES($1,$2)`,
    [req.id, req]
  );

  await addAdminLog({ type: "withdraw_request", ...req });
  return req;
}

async function listWithdrawals() {
  const res = await pool.query(
    `SELECT data FROM withdrawals ORDER BY id`
  );
  return res.rows.map(r => r.data);
}

async function completeWithdrawal(id, adminId) {
  const res = await pool.query(
    `SELECT data FROM withdrawals WHERE id=$1`,
    [id]
  );
  if (!res.rows.length) return null;

  const req = res.rows[0].data;
  req.status = "paid";
  req.paidAt = new Date().toISOString();
  req.paidBy = adminId;

  const u = await getUser(req.telegramId);
  u.totalWithdrawn = (u.totalWithdrawn || 0) + req.amount;

  await setUser(req.telegramId, u);
  await addAdminLog({ type: "withdraw_paid", ...req });

  await pool.query(
    `DELETE FROM withdrawals WHERE id=$1`,
    [id]
  );

  return req;
}

/* ======================================================================
   LOGS
====================================================================== */

async function addPublicLog(text) {
  await pool.query(
    `INSERT INTO logs_public(text) VALUES($1)`,
    [text]
  );
}

async function addAdminLog(data) {
  await pool.query(
    `INSERT INTO logs_admin(data) VALUES($1)`,
    [data]
  );
}

/* ======================================================================
   DAILY RESET
====================================================================== */

async function resetDailyTotals() {
  const cfg = await getConfig();

  cfg.totalDistributedTodayUsd = 0;

  await updateConfig(() => cfg);

  return true;
}

/* ======================================================================
   EXPORTS
====================================================================== */

module.exports = {
  ensure,
  read,
  getUser,
  setUser,
  findUsersByWallet,

  updateConfig,
  getConfig,

  addWithdrawal,
  listWithdrawals,
  completeWithdrawal,

  isBlocked,
  blockUser,
  unblockUser,

  recordAttempt,
  countRecentAttempts,

  addPublicLog,
  addAdminLog,

  resetDailyTotals
};
