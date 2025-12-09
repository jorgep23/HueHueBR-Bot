// services/dropper.js

const storage = require("./storage");
const { getHbrPriceUsd } = require("./pancakeswap");
const { getFounderCount } = require("./founders");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION
});

const DROP_INTERVAL = 20 * 60 * 1000;
let dropRunning = false;

/* ========================================================================
   LAST DROP STATE
======================================================================= */
async function getLastDropTimestamp() {
  const r = await pool.query("SELECT last_drop FROM drop_state WHERE id=1");
  return r.rows.length ? r.rows[0].last_drop : null;
}

async function updateLastDropTimestamp(ts) {
  await pool.query("UPDATE drop_state SET last_drop=$1 WHERE id=1", [ts]);
}


/* ========================================================================
   PERFORM DROP
======================================================================= */
async function performDrop(bot) {
  if (dropRunning) return;
  dropRunning = true;

  try {
    console.log("\n==================== DROP ====================");

    /* ---------- 1) PRICE ---------- */
    let price = await getHbrPriceUsd(process.env.HBR_CONTRACT);
    if (!price || isNaN(price) || price <= 0) {
      console.warn("⚠️ Preço inválido, fallback 0.00001");
      price = 0.00001;
    }

    /* ---------- 2) RANDOM USD ---------- */
    const MIN = Number(process.env.DROP_MIN_USD || 0.01);
    const MAX = Number(process.env.DROP_MAX_USD || 0.04);

    const usdReward = Number((Math.random() * (MAX - MIN) + MIN).toFixed(4));
    const baseHbr   = Number((usdReward / price).toFixed(4));

    if (!isFinite(baseHbr) || baseHbr <= 0) {
      dropRunning = false;
      return;
    }

    /* ---------- 3) RANDOM USER ---------- */
    const allUsers = await storage.read();
    const users = Object.entries(allUsers.users)
      .map(([telegramId, data]) => ({ telegramId, ...data }))
      .filter(u => u.wallet && !u.blocked);

    if (!users.length) {
      dropRunning = false;
      return;
    }

    const randomUser = users[Math.floor(Math.random() * users.length)];

    /* ---------- 4) BONUS FOUNDER ---------- */
    const wallet       = String(randomUser.wallet || "").trim();
    const founderCount = await getFounderCount(wallet);

    const bonusPct = Math.min(founderCount * 0.05, 0.25);
    const bonusHbr = Number((baseHbr * bonusPct).toFixed(4));
    const finalHbr = Number((baseHbr + bonusHbr).toFixed(4));


    /* ---------- 5) BALANCE UPDATE ---------- */
    const today = Math.floor(Date.now() / (24 * 3600 * 1000));

    let {
      balance        = 0,
      totalAllTime   = 0,
      totalToday     = 0,
      totalWithdrawn = 0,
      lastDropDay    = today
    } = randomUser;

    if (lastDropDay !== today) {
      totalToday = 0;
      lastDropDay = today;
    }

    totalAllTime += finalHbr;
    totalToday   += finalHbr;
    balance       = totalAllTime - totalWithdrawn;

    await storage.setUser(randomUser.telegramId, {
      balance,
      totalAllTime,
      totalToday,
      totalWithdrawn,
      lastDropDay,
      wallet,
      username: randomUser.username
    });

    console.log("💾 SALDO ATUALIZADO:", {
      balance,
      totalAllTime,
      totalToday,
      founderCount
    });


    /* ---------- 6) MSG GROUP ---------- */
    const GROUP_ID = process.env.GROUP_ID;

    if (GROUP_ID) {

      if (founderCount > 0) {

        await bot.sendMessage(
          GROUP_ID,
          `🔥 *DROP FOUNDER!*\n` +
          `👤 @${randomUser.username}\n` +
          `👑 NFT Founders: *${founderCount}*\n\n` +
          `🎁 Base: \`${baseHbr} HBR\`\n` +
          `💎 Bônus ${(bonusPct * 100).toFixed(0)}%: \`+${bonusHbr} HBR\`\n` +
          `🚀 Total: \`${finalHbr} HBR\`\n\n` +
          `💲 USD: \`$${usdReward}\`\n` +
          `⏱ Próximo drop → 20 minutos.`,
          { parse_mode: "Markdown" }
        );

      } else {

        await bot.sendMessage(
          GROUP_ID,
          `🎉 *DROP ENTREGUE!*\n` +
          `👤 @${randomUser.username}\n` +
          `📦 \`${finalHbr} HBR\`\n` +
          `💲 USD: \`$${usdReward}\`\n` +
          `⏱ Próximo → 20 minutos.`,
          { parse_mode: "Markdown" }
        );

      }
    }


    /* ---------- 7) LAST DROP ---------- */
    await updateLastDropTimestamp(new Date());


  } catch (err) {
    console.error("❌ DROP ERROR:", err);
  }

  dropRunning = false;
}


/* ========================================================================
   START DROPPER
======================================================================= */
async function startDropper(bot) {

  const last = await getLastDropTimestamp();
  const now  = Date.now();

  let nextDropIn = DROP_INTERVAL;

  if (last) {
    const diff = now - new Date(last).getTime();
    nextDropIn = diff >= DROP_INTERVAL ? 0 : DROP_INTERVAL - diff;
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
