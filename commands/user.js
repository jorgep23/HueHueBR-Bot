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
    bot.sendMessage(msg.chat.id, `📊 Seus ganhos\nHoje: ${today} HBR\nTotal: ${all} HBR`);
  });

  // withdraw request
  bot.onText(/\/withdraw\s+(\d+)/, (msg, match) => {
    const amount = Number(match[1]);
    if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Use: /withdraw 1000 (quantia em HBR)');
    const u = storage.getUser(msg.from.id);
    if (!u || !u.wallet) return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');
    const id = uuidv4();
    const req = { id, telegramId: msg.from.id, username: msg.from.username || msg.from.first_name, amount, wallet: u.wallet, createdAt: new Date() };
    storage.addWithdrawal(req);
    bot.sendMessage(msg.chat.id, `✅ Solicitação criada. ID: ${id}. Um admin irá revisar.`);
    // notify admin chat (private admin id)
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      bot.sendMessage(ADMIN_ID, `📥 Novo saque\nID: ${id}\nUser: @${req.username}\nAmount: ${amount} HBR\nWallet: ${req.wallet}`);
    }
  });
}

module.exports = { botUserHandlers };
