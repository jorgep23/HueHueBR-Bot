const storage = require('./storage');
const crypto = require('crypto');

// selecionar usuário elegível
async function pickRecipient() {
  const db = storage.read();
  const users = Object.entries(db.users).filter(([id, u]) =>
    u && u.wallet && !u.blocked
  );
  if (!users.length) return null;

  const cfg = db.config;

  const eligible = users.filter(([id, u]) => {
    const totalToday = u.totalToday || 0;
    return totalToday < cfg.maxDailyPerUser;
  });

  if (!eligible.length) return null;

  const idx = crypto.randomInt(0, eligible.length);
  const [telegramId, user] = eligible[idx];
  return { telegramId, user };
}

async function performDrop(bot) {
  try {
    const db = storage.read();
    const cfg = db.config;

    const recipient = await pickRecipient();
    if (!recipient) return;

    const user = recipient.user; // ← SEMPRE usar este, pois vem atualizado do DB
    const telegramId = recipient.telegramId;

    const amount = cfg.minHbr + crypto.randomInt(cfg.maxHbr - cfg.minHbr + 1);
    const today = Math.floor(Date.now() / (24 * 3600 * 1000));

    // respeitar limite diário
    if ((user.totalToday || 0) + amount > cfg.maxDailyPerUser) {
      return;
    }

    // atualizar estatísticas
    const newTotalToday = (user.totalToday || 0) + amount;
    const newAll = (user.totalAllTime || 0) + amount;

    storage.setUser(telegramId, {
      wallet: user.wallet,
      username: user.username || null,
      totalToday: newTotalToday,
      totalAllTime: newAll,
      lastDropDay: today
    });

    // adicionar logs
    const usernameSafe = user.username || telegramId;

    storage.addPublicLog({
      text: `🎉 DROP - @${usernameSafe} recebeu ${amount} HBR (~$${(
        amount * cfg.priceUsd
      ).toFixed(6)})`
    });

    storage.addAdminLog({
      type: 'drop',
      telegramId,
      username: user.username || null,
      amount,
      ts: new Date().toISOString()
    });

    // anti-fraude
    const attempts = storage.recordAttempt(telegramId, 'drop_received');
    const recent = storage.countRecentAttempts(telegramId, 60 * 60 * 1000); // 1h

    if (recent > 20) {
      storage.incrementSuspicion(telegramId);

      if (storage.read().config.autoBlockOnSuspicion) {
        storage.blockUser(telegramId, 'too_many_drops');

        const ADMIN_ID = process.env.ADMIN_ID;
        if (ADMIN_ID) {
          await bot.sendMessage(
            ADMIN_ID,
            `⚠️ Usuário @${usernameSafe} bloqueado automaticamente por suspeita.`
          );
        }
      }
    }

    // anunciar no grupo
    const GROUP_ID = process.env.GROUP_ID;

    const msg = `🎉 DROP ALEATÓRIO

O membro @${usernameSafe} recebeu *${amount} HBR* (~$${(
      amount * cfg.priceUsd
    ).toFixed(6)})
Carteira: \`${user.wallet}\``;

    if (GROUP_ID) {
      await bot.sendMessage(GROUP_ID, msg, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('performDrop error', err);
  }
}

let intervalHandle = null;

async function startDropper(bot) {
  const db = storage.read();
  const cfg = db.config;

  const minutes = cfg.intervalMin || 20;

  // primeiro drop após 5s
  setTimeout(() => performDrop(bot), 5000);

  intervalHandle = setInterval(
    () => performDrop(bot),
    minutes * 60 * 1000
  );

  console.log('Dropper started: every', minutes, 'minutes');
}

module.exports = { startDropper, performDrop };
