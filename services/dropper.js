// services/dropper.js
const storage = require('./storage');
const crypto = require('crypto');
const { getHbrPriceUsd } = require('./pancakeswap');

// select eligible user (checks group membership and per-user daily caps)
async function pickRecipient(bot) {
  const db = await storage.read();
  const entries = Object.entries(db.users).filter(([id,u]) => u && u.wallet && !u.blocked);
  if (!entries.length) return null;

  const cfg = db.config;
  const eligible = [];
  for (const [id, user] of entries) {
    const totalToday = user.totalToday || 0;
    if (totalToday >= cfg.maxDailyPerUser) continue;
    // verify user in group
    try {
      const member = await bot.getChatMember(process.env.GROUP_ID, Number(id));
      if (!['creator','administrator','member','restricted'].includes(member.status)) continue;
    } catch (e) {
      continue;
    }
    const weight = Math.max(1, Number(user.weight || 1));
    eligible.push({ id, user, weight });
  }
  if (!eligible.length) return null;

  const totalWeight = eligible.reduce((s,e) => s + e.weight, 0);
  let r = crypto.randomInt(0, totalWeight);
  for (const e of eligible) {
    if (r < e.weight) return { telegramId: e.id, user: e.user };
    r -= e.weight;
  }
  // fallback
  const any = eligible[crypto.randomInt(0, eligible.length)];
  return { telegramId: any.id, user: any.user };
}

async function performDrop(bot) {
  try {
    const cfg = await storage.getConfig();
    const recipient = await pickRecipient(bot);
    if (!recipient) return;

    // USD reward (triangular-ish distribution)
    const minUsd = Number(process.env.DROP_MIN_USD || 0.1);
    const maxUsd = Number(process.env.DROP_MAX_USD || 0.5);
    const rnd = Math.random();
    const rewardUsd = minUsd + (maxUsd - minUsd) * Math.sqrt(rnd);

    // get HBR price
    const hbrAddress = process.env.HBR_CONTRACT;
    let price = null;
    if (hbrAddress) price = await getHbrPriceUsd(hbrAddress);
    // compute amount HBR (fallback to cfg.minHbr)
    let amountHbr;
    if (price) {
      amountHbr = Number((rewardUsd / price).toFixed(6)); // 6 decimals
      if (amountHbr < 1) amountHbr = 1;
    } else {
      // fallback using configured priceUsd
      amountHbr = Math.max(1, Math.round((rewardUsd / cfg.priceUsd) || cfg.minHbr));
    }

    // check global daily USD cap
    const db = await storage.read();
    if ((db.config.totalDistributedTodayUsd || 0) + rewardUsd > (db.config.maxDailyRewardUsd || Number(process.env.MAX_DAILY_REWARD_USD || 1.0))) {
      const GROUP_ID = process.env.GROUP_ID;
      if (GROUP_ID) {
        const msg = `⚠️ *Limite Diário de Drops Atingido*\n\nO total distribuído hoje atingiu *$${(db.config.maxDailyRewardUsd || Number(process.env.MAX_DAILY_REWARD_USD || 1.0)).toFixed(2)}*. Nenhum novo drop será distribuído hoje.`;
        try { await bot.sendMessage(GROUP_ID, msg, { parse_mode:'Markdown' }); } catch(e){}
      }
      return;
    }

    // enforce per-user daily cap
    const user = await storage.getUser(recipient.telegramId) || recipient.user || {};
    const today = Math.floor(Date.now()/(24*3600));
    if ((user.totalToday || 0) + amountHbr > cfg.maxDailyPerUser) return;

    // update user stats
    const newTotalToday = (user.totalToday || 0) + amountHbr;
    const newAll = (user.totalAllTime || 0) + amountHbr;
    await storage.setUser(recipient.telegramId, { wallet: user.wallet, username: user.username || null, totalToday: newTotalToday, totalAllTime: newAll, lastDropDay: today });

    // update global USD distributed
    await storage.addDistributedUsd(rewardUsd);

    // logs
    const usernameSafe = user.username || recipient.telegramId;
    await storage.addPublicLog(`🎉 DROP - @${usernameSafe} recebeu ${amountHbr} HBR (~$${rewardUsd.toFixed(4)})`);
    await storage.addAdminLog({ type:'drop', telegramId: recipient.telegramId, username: user.username || null, amount: amountHbr, usd: rewardUsd, ts: new Date().toISOString() });

    // anti-fraud
    await storage.recordAttempt(recipient.telegramId, 'drop_received');
    const recent = await storage.countRecentAttempts(recipient.telegramId, 60*60*1000);
    if (recent > 20) {
      await storage.incrementSuspicion(recipient.telegramId);
      const cfgRead = await storage.getConfig();
      if (cfgRead.autoBlockOnSuspicion) {
        await storage.blockUser(recipient.telegramId, 'too_many_drops');
        const ADMIN_ID = process.env.ADMIN_ID;
        if (ADMIN_ID) {
          await bot.sendMessage(ADMIN_ID, `⚠️ Usuário @${usernameSafe} bloqueado por muitas drops em curto período.`);
        }
      }
    }

    // announce in group
    const GROUP_ID = process.env.GROUP_ID;
    const msg = `💸 *DROP ALEATÓRIO* 💸\n\nMembro: @${usernameSafe}\nValor: *${amountHbr} HBR* (~$${rewardUsd.toFixed(4)})\nCarteira: \`${user.wallet}\`\n\nParabéns! 🎉`;
    if (GROUP_ID) await bot.sendMessage(GROUP_ID, msg, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('performDrop error', err);
  }
}

let intervalHandle = null;

async function startDropper(bot) {
  const cfg = await storage.getConfig();
  const minutes = cfg.intervalMin || Number(process.env.DROP_INTERVAL_MIN || 20);
  setTimeout(()=>performDrop(bot), 5000);
  intervalHandle = setInterval(()=>performDrop(bot), minutes * 60 * 1000);
  console.log('Dropper started: every', minutes, 'minutes');
}

module.exports = { startDropper, performDrop, pickRecipient };
