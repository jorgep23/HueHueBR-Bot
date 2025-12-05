// services/dropper.js

const storage = require('./storage');
const { getHbrPriceUsd } = require('./pancakeswap');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

const DROP_INTERVAL = 20 * 60 * 1000; // 20 minutos
let dropRunning = false;

// -------------------------------------------------------
// LAST DROP (PostgreSQL)
// -------------------------------------------------------

async function getLastDropTimestamp() {
  const result = await pool.query("SELECT last_drop FROM drop_state WHERE id = 1");
  if (result.rows.length === 0) return null;
  return result.rows[0].last_drop;
}

async function updateLastDropTimestamp(ts) {
  await pool.query("UPDATE drop_state SET last_drop = $1 WHERE id = 1", [ts]);
}

// -------------------------------------------------------
// DROP FUNCTION
// -------------------------------------------------------

async function performDrop(bot) {
  if (dropRunning) return;
  dropRunning = true;

  try {
    const price = await getHbrPriceUsd();
    const cfg = await storage.getConfig();

    const usdReward = Number((Math.random() * 0.03 + 0.01).toFixed(4)); // $0.01 → $0.04
    const hbrAmount = Number((usdReward / price).toFixed(2));

    const allUsers = await storage.read();
    const usersList = Object.values(allUsers.users).filter(u => u.wallet && !u.blocked);

    if (usersList.length === 0) {
      dropRunning = false;
      return;
    }

    const randomUser = usersList[Math.floor(Math.random() * usersList.length)];

    await storage.setUser(randomUser.telegramId, {
      balance: (randomUser.balance || 0) + hbrAmount
    });

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

// -------------------------------------------------------
// START DROPPER
// -------------------------------------------------------

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
      nextDropIn = DROP_INTERVAL;
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
