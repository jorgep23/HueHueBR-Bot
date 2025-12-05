// services/dropper.js

const storage = require('./storage');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

async function getLastDropTimestamp() {
  const res = await pool.query("SELECT last_drop FROM drop_state WHERE id = 1");
  return res.rows.length ? res.rows[0].last_drop : null;
}
const { getHbrPriceUsd } = require('./pancakeswap');

const DROP_INTERVAL = 20 * 60 * 1000; // 20 minutos
let dropRunning = false;

// --- PERSISTÊNCIA DO DROP ---
async function getLastDropTimestamp() {
  const row = await storage.getDropState();
  return row ? row.last_drop : null;
}

async function updateLastDropTimestamp(ts) {
  await storage.updateDropState(ts);
}

// --- EXECUTA O DROP ---
async function performDrop(bot) {
  if (dropRunning) return;
  dropRunning = true;

  try {
    const price = await getHbrPriceUsd();
    const usdReward = Number((Math.random() * 0.03 + 0.01).toFixed(4)); 
    const hbrAmount = Number((usdReward / price).toFixed(2));

    const users = await storage.getAllUsers();
    const eligible = users.filter(u => u.wallet && !u.blocked);

    if (eligible.length === 0) return;

    const randomUser = eligible[Math.floor(Math.random() * eligible.length)];

    await storage.addReward(randomUser.telegram_id, hbrAmount);

    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      await bot.sendMessage(
        GROUP_ID,
        `🎉 *DROP ENTREGUE!*\n` +
        `👤 Usuário: @${randomUser.username}\n` +
        `📦 Recompensa: *${hbrAmount} HBR*\n` +
        `💲 Valor: *$${usdReward}*\n` +
        `⏱ Próximo em 20 minutos.`,
        { parse_mode: "Markdown" }
      );
    }

    await updateLastDropTimestamp(new Date());

  } catch (err) {
    console.error("performDrop error", err);
  }

  dropRunning = false;
}

// --- SISTEMA DE TIMER PERSISTENTE ---
async function startDropper(bot) {
  const last = await getLastDropTimestamp();
  const now = Date.now();

  let nextDropIn = DROP_INTERVAL;

  if (last) {
    const lastTs = new Date(last).getTime();
    const diff = now - lastTs;

    if (diff >= DROP_INTERVAL) {
      console.log("Drop atrasado → executando agora...");
      performDrop(bot);
    } else {
      nextDropIn = DROP_INTERVAL - diff;
      console.log(`Próximo drop em ${(nextDropIn / 1000 / 60).toFixed(1)} min`);
    }
  }

  setTimeout(() => {
    performDrop(bot);
    setInterval(() => performDrop(bot), DROP_INTERVAL);
  }, nextDropIn);
}

module.exports = { startDropper };
