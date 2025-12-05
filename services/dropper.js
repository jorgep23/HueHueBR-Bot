// services/dropper.js

const storage = require('../services/storage');
const { getHbrPriceUsd } = require('./pancakeswap');

const DROP_INTERVAL = 20 * 60 * 1000; // 20 minutos
let dropRunning = false;

async function getLastDropTimestamp() {
  const result = await db.query("SELECT last_drop FROM drop_state WHERE id = 1");
  if (result.rows.length === 0) return null;
  return result.rows[0].last_drop;
}

async function updateLastDropTimestamp(ts) {
  await db.query(
    "UPDATE drop_state SET last_drop = $1 WHERE id = 1",
    [ts]
  );
}

async function performDrop(bot) {
  if (dropRunning) return; // impede duplicação
  dropRunning = true;

  try {
    const price = await getHbrPriceUsd();
    const cfg = storage.read().config;

    // random USD → HBR
    const usdReward = Number((Math.random() * 0.03 + 0.01).toFixed(4)); // $0.01 → $0.04
    const hbrAmount = Number((usdReward / price).toFixed(2));

    const users = storage.getAllUsers().filter(u => u.wallet && !u.blocked);
    if (users.length === 0) return;

    const randomUser = users[Math.floor(Math.random() * users.length)];

    storage.addReward(randomUser.telegramId, hbrAmount);

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

// inicia o sistema persistente
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

  // primeiro timer do ciclo
  setTimeout(() => {
    performDrop(bot);

    // timers seguintes sempre a cada 20 minutos
    setInterval(() => performDrop(bot), DROP_INTERVAL);

  }, nextDropIn);
}

module.exports = { startDropper };
