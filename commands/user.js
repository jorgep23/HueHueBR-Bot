// commands/user.js
const storage = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

function botUserHandlers(bot){
  // price
  bot.onText(/\/price/, async (msg) => {
    const db = await storage.read();
    const p = (db.config && db.config.priceUsd) || 0;
    await bot.sendMessage(msg.chat.id, `💰 Preço HBR (config): $${p}`);
  });

  // mypoints
  bot.onText(/\/mypoints/, async (msg) => {
    const u = await storage.getUser(msg.from.id);
    if (!u) return bot.sendMessage(msg.chat.id, '❌ Você não está registrado. Use /registrar 0xSuaCarteira (no privado).');
    const today = u.totalToday || 0;
    const all = u.totalAllTime || 0;
    const withdrawn = u.totalWithdrawn || 0;
    await bot.sendMessage(msg.chat.id, `📊 Seus ganhos\nHoje: ${today} HBR\nTotal: ${all} HBR\nRetirado: ${withdrawn} HBR`);
  });

  // registrar in private (kept for backward compat)
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];
    if (msg.chat.type !== 'private'){
      return bot.sendMessage(chatId, '🔐 Use este comando em PRIVADO com o bot: /registrar 0xSuaCarteira');
    }
    const user = await storage.setUser(msg.from.id, { wallet: wallet, username: msg.from.username || msg.from.first_name, registeredAt: new Date().toISOString(), weight:1 });
    await bot.sendMessage(chatId, '✅ Registrado! Sua carteira foi salva. Você passará a concorrer nos drops automáticos.');
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID){
      await storage.addPublicLog({ text: `📥 @${msg.from.username || msg.from.first_name} entrou nos drops.` });
    }
  });

  // withdraw request
  bot.onText(/\/withdraw\s+(\d+)/, async (msg, match) => {
    const amount = Number(match[1]);
    if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Use: /withdraw 1000 (quantia em HBR)');
    const u = await storage.getUser(msg.from.id);
    if (!u || !u.wallet) return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');

    if (await storage.isBlocked(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, '🚫 Sua conta está bloqueada por suspeita. Contate um admin.');
    }

    const balance = (u.totalAllTime || 0) - (u.totalWithdrawn || 0);
    if (balance < amount) {
      await storage.recordAttempt(msg.from.id, 'withdraw_fail_insufficient');
      return bot.sendMessage(msg.chat.id, `❌ Saldo insuficiente. Seu saldo disponível é ${balance} HBR.`);
    }

    const oneHour = 60*60*1000;
    await storage.recordAttempt(msg.from.id, 'withdraw_request');
    const recent = await storage.countRecentAttempts(msg.from.id, oneHour);
    const cfg = (await storage.getConfig());
    if (recent > cfg.fraudMaxWithdrawalsPerHour) {
      await storage.incrementSuspicion(msg.from.id);
      if (cfg.autoBlockOnSuspicion) {
        await storage.blockUser(msg.from.id, 'many_withdraw_attempts');
        await bot.sendMessage(msg.chat.id, '🚫 Sua conta foi bloqueada por atividade suspeita. Um admin foi notificado.');
        const ADMIN_ID = process.env.ADMIN_ID;
        if (ADMIN_ID) await bot.sendMessage(ADMIN_ID, `⚠️ Usuário @${u.username} bloqueado automaticamente por muitas tentativas de saque.`);
        return;
      }
    }

    const id = uuidv4();
    const req = { id, telegramId: msg.from.id, username: msg.from.username || msg.from.first_name, amount, wallet: u.wallet, createdAt: new Date().toISOString(), status: 'pending' };
    await storage.addWithdrawal(req);
    await bot.sendMessage(msg.chat.id, `✅ Solicitação criada. ID: ${id}. Um admin irá revisar.`);

    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      try {
        await bot.sendMessage(ADMIN_ID, `📥 Novo saque\nID: ${id}\nUser: @${req.username}\nAmount: ${amount} HBR\nWallet: ${req.wallet}`);
      } catch(e) {
        console.log('Admin DM failed; ensure admin started a chat with bot.');
      }
    }
  });
}

module.exports = { botUserHandlers };
