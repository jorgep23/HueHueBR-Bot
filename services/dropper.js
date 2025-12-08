// services/dropper.js

const storage = require('./storage');
const { getHbrPriceUsd } = require('./pancakeswap');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

const DROP_INTERVAL = 20 * 60 * 1000;
let dropRunning = false;


/* ---------------------------------------------
   LAST DROP STATE (PostgreSQL)
---------------------------------------------- */
async function getLastDropTimestamp() {
  const r = await pool.query("SELECT last_drop FROM drop_state WHERE id=1");
  return r.rows.length ? r.rows[0].last_drop : null;
}

async function updateLastDropTimestamp(ts) {
  await pool.query("UPDATE drop_state SET last_drop=$1 WHERE id=1", [ts]);
}


/* ---------------------------------------------
   PERFORM DROP
---------------------------------------------- */
async function performDrop(bot) {
  if (dropRunning) return;
  dropRunning = true;

  try {

    console.log("\n==================== DROP ====================");

    /* ---------- 1) REAL PRICE ---------- */
    let price = await getHbrPriceUsd(process.env.HBR_CONTRACT);

    if (!price || isNaN(price) || price <= 0) {
      console.error("⚠️ Preço inválido → fallback aplicado");
      price = 0.00001;
    }

    console.log("💲 HBR Price:", price);


    /* ---------- 2) RANDOM USD ---------- */
    const MIN = Number(process.env.DROP_MIN_USD || 0.01);
    const MAX = Number(process.env.DROP_MAX_USD || 0.04);

    const usdReward = Number((Math.random() * (MAX - MIN) + MIN).toFixed(4));
    const hbrAmount = Number((usdReward / price).toFixed(2));

    console.log("🎁 USD sorteado:", usdReward);
    console.log("📦 HBR calculado:", hbrAmount);

    if (!isFinite(hbrAmount) || isNaN(hbrAmount) || hbrAmount <= 0) {
      console.error("❌ Valor HBR inválido, cancelando drop");
      dropRunning = false;
      return;
    }


    /* ---------- 3) SELECT USER ---------- */
    const allUsers = await storage.read();

    const usersList = Object.entries(allUsers.users)
      .map(([telegramId, data]) => ({
        telegramId,
        ...data
      }))
      .filter(u => u.wallet && !u.blocked);

    if (!usersList.length) {
      console.log("⚠ Nenhum usuário elegível.");
      dropRunning = false;
      return;
    }

    const randomUser =
      usersList[Math.floor(Math.random() * usersList.length)];

    console.log("👤 User escolhido:", randomUser.telegramId, randomUser.username);


    /* ---------- 4) UPDATE BALANCES ---------- */
    const today = Math.floor(Date.now()/(24*3600*1000));

    let {
      balance = 0,
      totalAllTime = 0,
      totalToday = 0,
      totalWithdrawn = 0,
      lastDropDay = today
    } = randomUser;

    if (lastDropDay !== today) {
      totalToday = 0;
      lastDropDay = today;
    }

    totalAllTime += hbrAmount;
    totalToday += hbrAmount;
    balance = totalAllTime - totalWithdrawn;


    const newData = {
      telegramId: randomUser.telegramId,
      username: randomUser.username,
      wallet: randomUser.wallet,

      balance,
      totalAllTime,
      totalToday,
      totalWithdrawn,
      lastDropDay
    };


    await storage.setUser(randomUser.telegramId, newData);

    console.log("💾 Novo saldo atualizado:", newData);


    /* ---------- 5) SEND GROUP MESSAGE ---------- */
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


    /* ---------- 6) UPDATE LAST DROP ---------- */
    await updateLastDropTimestamp(new Date());


  } catch (err) {
    console.error("DROP ERROR:", err);
  }

  dropRunning = false;
}


/* ---------------------------------------------
   START DROPPER
---------------------------------------------- */
async function startDropper(bot) {

  const last = await getLastDropTimestamp();
  const now = Date.now();

  let nextDropIn = DROP_INTERVAL;

  if (last) {
    const diff = now - new Date(last).getTime();

    if (diff >= DROP_INTERVAL) {
      performDrop(bot);
    } else {
      nextDropIn = DROP_INTERVAL - diff;
      console.log(`⏳ Próximo drop em ${(nextDropIn/60000).toFixed(1)} min`);
    }
  }

  setTimeout(() => {
    performDrop(bot);
    setInterval(() => performDrop(bot), DROP_INTERVAL);
  }, nextDropIn);
}


module.exports = {
  startDropper,
  performDrop
};
