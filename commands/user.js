const storage = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

function botUserHandlers(bot){
  // price
  bot.onText(/\/price/, (msg) => {
    const db = storage.read();
    const p = db.config.priceUsd;
    bot.sendMessage(msg.chat.id, `💰 Preço HBR (manual): $${p}`);
  });

  // mypoints
  bot.onText(/\/mypoints/, (msg) => {
    const u = storage.getUser(msg.from.id);
    if (!u) return bot.sendMessage(msg.chat.id, '❌ Você não está registrado. Use /registrar 0xSuaCarteira (no privado).');
    const today = u.totalToday || 0;
    const all = u.totalAllTime || 0;
    const withdrawn = u.totalWithdrawn || 0;
    bot.sendMessage(msg.chat.id, `📊 Seus ganhos\nHoje: ${today} HBR\nTotal: ${all} HBR\nRetirado: ${withdrawn} HBR`);
  });

  // registrar in private
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];
    if (msg.chat.type !== 'private'){
      return bot.sendMessage(chatId, '🔐 Use este comando em PRIVADO com o bot: /registrar 0xSuaCarteira');
    }
    const checksum = wallet;
    const user = storage.setUser(msg.from.id, { wallet: checksum, username: msg.from.username || msg.from.first_name, registeredAt: new Date() });
    bot.sendMessage(chatId, '✅ Registrado! Sua carteira foi salva. Você passará a concorrer nos drops automáticos.');
    // detect duplicate wallets
    const dup = storage.findUsersByWallet(wallet);
    if (dup.length > 1) {
      storage.addAdminLog({ type:'duplicate_wallet', wallet, found: dup.map(d=>d.telegramId) });
    }
    // notify group if GROUP_ID
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID){
      bot.sendMessage(GROUP_ID, `📥 @${msg.from.username || msg.from.first_name} registrou a carteira e entrou nos drops!`);
      storage.addPublicLog({ text: `📥 @${msg.from.username || msg.from.first_name} entrou nos drops.` });
    }
  });

  // withdraw request
  bot.onText(/\/withdraw\s+(\d+)/, (msg, match) => {
    const amount = Number(match[1]);
    if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Use: /withdraw 1000 (quantia em HBR)');
    const u = storage.getUser(msg.from.id);
    if (!u || !u.wallet) return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');

    // check blocked
    if (storage.isBlocked(msg.from.id)) {
      return bot.sendMessage(msg.chat.id, '🚫 Sua conta está bloqueada por suspeita. Contate um admin.');
    }

    // Verifica saldo disponível: totalAllTime - totalWithdrawn
    const balance = (u.totalAllTime || 0) - (u.totalWithdrawn || 0);
    if (balance < amount) {
      // record attempt for fraud detection
      storage.recordAttempt(msg.from.id, 'withdraw_fail_insufficient');
      return bot.sendMessage(msg.chat.id, `❌ Saldo insuficiente. Seu saldo disponível é ${balance} HBR.`);
    }

    // fraud: count recent withdraw attempts in last hour
    const oneHour = 60*60*1000;
    storage.recordAttempt(msg.from.id, 'withdraw_request');
    const recent = storage.countRecentAttempts(msg.from.id, oneHour);
    const cfg = storage.read().config;
    if (recent > cfg.fraudMaxWithdrawalsPerHour) {
      storage.incrementSuspicion(msg.from.id);
      if (cfg.autoBlockOnSuspicion) {
        storage.blockUser(msg.from.id, 'many_withdraw_attempts');
        bot.sendMessage(msg.chat.id, '🚫 Sua conta foi bloqueada por atividade suspeita. Um admin foi notificado.');
        const ADMIN_ID = process.env.ADMIN_ID;
        if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `⚠️ Usuário @${u.username} bloqueado automaticamente por muitas tentativas de saque.`);
        return;
      }
    }

    // Cria solicitação
    const id = uuidv4();
    const req = { id, telegramId: msg.from.id, username: msg.from.username || msg.from.first_name, amount, wallet: u.wallet, createdAt: new Date().toISOString(), status: 'pending' };
    storage.addWithdrawal(req);
    bot.sendMessage(msg.chat.id, `✅ Solicitação criada. ID: ${id}. Um admin irá revisar.`);

    // notify admin (private)
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      bot.sendMessage(ADMIN_ID, `📥 Novo saque\nID: ${id}\nUser: @${req.username}\nAmount: ${amount} HBR\nWallet: ${req.wallet}`).catch(()=>{
        console.log('Admin not reachable via private message; ensure admin started a chat with bot.');
      });
    }
  });
}

module.exports = { botUserHandlers };
