const storage = require('./storage');
const crypto = require('crypto');

// select a random eligible user
async function pickRecipient(){
  const db = storage.read();
  const users = Object.entries(db.users).filter(([id,u]) => u && u.wallet);
  if (!users.length) return null;
  // filter by daily limit
  const cfg = db.config;
  const eligible = users.filter(([id,u]) => {
    const totalToday = u.totalToday || 0;
    return totalToday < cfg.maxDailyPerUser;
  });
  if (!eligible.length) return null;
  const idx = crypto.randomInt(0, eligible.length);
  const [telegramId, user] = eligible[idx];
  return { telegramId, user };
}

async function performDrop(bot){
  try {
    const db = storage.read();
    const cfg = db.config;
    const recipient = await pickRecipient();
    if (!recipient) return;
    const amount = cfg.minHbr + crypto.randomInt(cfg.maxHbr - cfg.minHbr + 1);
    // enforce not exceeding daily cap
    const user = storage.getUser(recipient.telegramId) || {};
    const today = Math.floor(Date.now()/(24*3600));
    if ((user.totalToday || 0) + amount > cfg.maxDailyPerUser){
      return;
    }
    // update user stats
    const newTotalToday = (user.totalToday || 0) + amount;
    const newAll = (user.totalAllTime || 0) + amount;
    storage.setUser(recipient.telegramId, { wallet: user.wallet, username: user.username, totalToday: newTotalToday, totalAllTime: newAll, lastDropDay: today });
    // announce in group
    const GROUP_ID = process.env.GROUP_ID;
    const msg = `🎉 DROP ALEATÓRIO\n\nO membro @${user.username || recipient.telegramId} recebeu *${amount} HBR* (~$${(amount * cfg.priceUsd).toFixed(6)})\nCarteira: \`${user.wallet}\``;
    if (GROUP_ID) await bot.sendMessage(GROUP_ID, msg, { parse_mode: 'Markdown' });
  } catch (err){
    console.error('performDrop error', err);
  }
}

let intervalHandle = null;

async function startDropper(bot){
  const db = storage.read();
  const cfg = db.config;
  const minutes = cfg.intervalMin || 20;
  // initial delay
  setTimeout(()=>performDrop(bot), 5000);
  intervalHandle = setInterval(()=>performDrop(bot), minutes * 60 * 1000);
  console.log('Dropper started: every', minutes, 'minutes');
}

module.exports = { startDropper, performDrop };
