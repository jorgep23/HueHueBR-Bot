// services/storage.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

// -------------------------------------------------------
// FUNÇÃO AUXILIAR: garante estrutura padrão de usuário
// -------------------------------------------------------
function normalizeUser(u = {}) {
  return {
    wallet: u.wallet || null,
    username: u.username || null,
    balance: typeof u.balance === "number" && !isNaN(u.balance) ? u.balance : 0,
    blocked: u.blocked === true,  // boolean
    totalToday: typeof u.totalToday === "number" && !isNaN(u.totalToday) ? u.totalToday : 0,
    lastDropDay: typeof u.lastDropDay === "number" ? u.lastDropDay : 0
  };
}

// -------------------------------------------------------
// READ DATABASE
// -------------------------------------------------------
async function read() {
  const db = { users: {} };

  const cu = await pool.query("SELECT telegram_id, data FROM users");

  cu.rows.forEach(r => {
    db.users[r.telegram_id] = normalizeUser(r.data);
  });

  return db;
}

// -------------------------------------------------------
// GET USER
// -------------------------------------------------------
async function getUser(telegramId) {
  const key = String(telegramId);
  const result = await pool.query("SELECT data FROM users WHERE telegram_id = $1", [key]);

  if (result.rows.length === 0) return null;

  return normalizeUser(result.rows[0].data);
}

// -------------------------------------------------------
// SET USER
// -------------------------------------------------------
async function setUser(telegramId, obj) {
  const key = String(telegramId);

  let existing = await getUser(key);
  if (!existing) existing = normalizeUser({});

  // Mescla dados novos + antigos
  const merged = normalizeUser({
    ...existing,
    ...obj
  });

  await pool.query(
    `
      INSERT INTO users(telegram_id, data)
      VALUES($1, $2)
      ON CONFLICT (telegram_id)
      DO UPDATE SET data = $2
    `,
    [key, merged]
  );

  return merged;
}

// -------------------------------------------------------
// EXPORTS
// -------------------------------------------------------
module.exports = {
  read,
  getUser,
  setUser
};
