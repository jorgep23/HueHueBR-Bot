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
// LAST DROP STATE
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
    console.log("\n==================== DROP ====================");

    // 1) preço
    let price = await getHbrPriceUsd(process.env.HBR_CONTRACT);

    if (!price || isNaN(price) || price <= 0) {
      console.error("⚠️ Preço inválido HBR → fallback");
      price = 0.00001;
    }

    console.log("💲 HBR Price (USD):", price);


    // 2) valores aleatórios configuráveis
    const MIN = Number(process.env.DROP_MIN_USD || 0.01);
    const MAX = Number(process.env.DROP_MAX_USD || 0.04);

    const usdReward = Number((Math.random() * (MAX - MIN) + MIN).toFixed(4));
    const hbrAmount = Number((usdReward / price).toFixed(2));

    console.log("🎁 Sorteado USD:", usdReward);
    console.log("📦 Calculado HBR:", hbrAmount);


    if (!isFinite(hbrAmount) || isNaN(hbrAmount) || hbrAmount <= 0) {
      console.error("❌ HBR inválido — DROP cancelado");
      dropRunning = false;
      return;
    }


    // 3) usuários
    const allUsers = await storage.read();
    const usersList = Object.entries(allUsers.users)
      .map(([telegramId, data]) => ({
        telegramId,
        ...data
      }))
      .filter(u => u.wallet && !u.blocked);


    if (usersList.length === 0) {
      console.log("⚠ Nenhum usuário elegível.");
      dropRunning = false;
      return;
    }


    // 4) escolhe random
    const randomUser = usersList[Math.floor(Math.random() * usersList.length)];

    console.log("👤 Escolhido:", randomUser.username, randomUser.telegramId);


    // 5) atualiza pontuação correta
    const today = Math.floor(Date.now() / (24*3600*1000));

    let {
      balance = 0,
      totalAllTime = 0,
      totalToday = 0,
      lastDropDay = today
    } = randomUser;


    // reset diário individual
    if (lastDropDay !== today) {
      totalToday = 0;
      lastDropDay = today;
    }


    const newData = {
      balance: balance + hbrAmount,
      totalAllTime: totalAllTime + hbrAmount,
      totalToday: totalToday + hbrAmount,
      lastDropDay
    };

    await storage.setUser(randomUser.telegramId, newData);


    // 6) log no terminal
    console.log("💾 Novo saldo:", newData);


    // 7) mensagem no grupo
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


    // 8) salva timestamp
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
      console.log("⚠ Drop atrasado — executando agora...");
      performDrop(bot);
      nextDropIn = DROP_INTERVAL;
    } else {
      nextDropIn = DROP_INTERVAL - diff;
      console.log(`⏳ Próximo drop em ${(nextDropIn / 60000).toFixed(1)} min`);
    }
  }

  setTimeout(() => {
    performDrop(bot);
    setInterval(() => performDrop(bot), DROP_INTERVAL);
  }, nextDropIn);
}


module.exports = { startDropper, performDrop };
