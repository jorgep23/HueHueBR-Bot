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


/* ============================================================
   POSTGRES STATE
============================================================ */
async function getLastDropTimestamp() {
  const r = await pool.query("SELECT last_drop FROM drop_state WHERE id=1");
  return r.rows.length ? r.rows[0].last_drop : null;
}

async function updateLastDropTimestamp(ts) {
  await pool.query("UPDATE drop_state SET last_drop=$1 WHERE id=1", [ts]);
}


/* ============================================================
   MAIN DROP FUNCTION
============================================================ */
async function performDrop(bot) {
  if (dropRunning) return;
  dropRunning = true;

  try {
    console.log("\n==================== DROP ====================");

    /* ---------- 1) PREÇO ---------- */
    let price = await getHbrPriceUsd(process.env.HBR_CONTRACT);

    if (!price || price <= 0 || isNaN(price)) {
      console.warn("⚠️ Preço inválido, fallback");
      price = 0.00001;
    }

    /* ---------- 2) REWARD USD (com ruído real) ---------- */
    const MIN = Number(process.env.DROP_MIN_USD || 0.010);
    const MAX = Number(process.env.DROP_MAX_USD || 0.040);

    let usdReward = Math.random() * (MAX - MIN) + MIN;

    // ruído → nunca repetir exatamente igual
    usdReward += Math.random() * 0.0007;
    usdReward = Number(usdReward.toFixed(6));

    /* ---------- 3) CALCULO HBR ---------- */
    // mantém precisão máxima, arredonda apenas na mensagem
    const baseHbr = usdReward / price;

    if (!isFinite(baseHbr) || baseHbr <= 0) {
      dropRunning = false;
      return;
    }


    /* ---------- 4) RANDOM USER ---------- */
    const allUsers = await storage.read();
    const users = Object.entries(allUsers.users)
      .map(([telegramId, u]) => ({ telegramId, ...u }))
      .filter(u => u.wallet && !u.blocked);

    if (!users.length) {
      dropRunning = false;
      return;
    }

    const randomUser =
      users[Math.floor(Math.random() * users.length)];


    /* ---------- 5) BONUS NFT FOUNDERS ---------- */
    const wallet       = String(randomUser.wallet || "").trim();
    const founderCount = await getFounderCount(wallet);

    const bonusPct  = Math.min(founderCount * 0.05, 0.25);  // até 25%
    const bonusHbr  = baseHbr * bonusPct;
    const finalHbr  = baseHbr + bonusHbr;


    /* ---------- 6) UPDATE USER BALANCE ---------- */
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
      wallet,
      username: randomUser.username,
      balance,
      totalAllTime,
      totalToday,
      totalWithdrawn,
      lastDropDay
    });


    /* ---------- 7) MESSAGE ---------- */
    const GROUP = process.env.GROUP_ID;

    const showBase  = baseHbr.toFixed(4);
    const showBonus = bonusHbr.toFixed(4);
    const showFinal = finalHbr.toFixed(4);
    const showUsd   = usdReward.toFixed(6);

    if (GROUP) {

      if (founderCount > 0) {
        await bot.sendMessage(
          GROUP,
          `🔥 *DROP FOUNDER!*\n` +
          `👤 @${randomUser.username}\n` +
          `👑 *${founderCount}* NFT Founders\n\n` +
          `🎁 Base: \`${showBase} HBR\`\n` +
          `💎 Bônus ${(bonusPct * 100).toFixed(0)}%: \`+${showBonus} HBR\`\n` +
          `🚀 Total: \`${showFinal} HBR\`\n\n` +
          `💲 USD: \`$${showUsd}\`\n` +
          `⏱ Próximo → 20 min`,
          { parse_mode: "Markdown" }
        );
      } else {
        await bot.sendMessage(
          GROUP,
          `🎉 *DROP ENTREGUE!*\n` +
          `👤 @${randomUser.username}\n` +
          `📦 \`${showFinal} HBR\`\n` +
          `💲 \`$${showUsd}\`\n` +
          `⏱ Próximo → 20 min`,
          { parse_mode: "Markdown" }
        );
      }
    }


    /* ---------- 8) TIME DB ---------- */
    await updateLastDropTimestamp(new Date());

  } catch (err) {
    console.error("❌ DROP ERROR:", err);
  }

  dropRunning = false;
}


/* ============================================================
   START
============================================================ */
async function startDropper(bot) {

  const last = await getLastDropTimestamp();
  const now  = Date.now();

  let next = DROP_INTERVAL;

  if (last) {
    const diff = now - new Date(last).getTime();
    next = diff >= DROP_INTERVAL ? 0 : (DROP_INTERVAL - diff);
  }

  setTimeout(() => {
    performDrop(bot);
    setInterval(() => performDrop(bot), DROP_INTERVAL);
  }, next);
}


module.exports = {
  startDropper,
  performDrop
};
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
