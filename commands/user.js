const storage = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

function botUserHandlers(bot) {
  // Preço
  bot.onText(/\/price/, (msg) => {
    const db = storage.read();
    const p = db.config.priceUsd;
    bot.sendMessage(msg.chat.id, `💰 Preço HBR (manual): $${p}`);
  });

  // Meus pontos
  bot.onText(/\/mypoints/, (msg) => {
    const u = storage.getUser(msg.from.id);
    if (!u) return bot.sendMessage(msg.chat.id, '❌ Você não está registrado. Use /registrar 0xSuaCarteira (no privado).');
    const today = u.totalToday || 0;
    const all = u.totalAllTime || 0;
    bot.sendMessage(msg.chat.id, `📊 Seus ganhos\nHoje: ${today} HBR\nTotal: ${all} HBR`);
  });

  // Solicitação de saque
  bot.onText(/\/withdraw\s+(\d+)/, (msg, match) => {
    const amount = Number(match[1]);
    if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Use: /withdraw 1000 (quantia em HBR)');

    const u = storage.getUser(msg.from.id);
    if (!u || !u.wallet) return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');

    // Verifica saldo disponível
    const balance = u.totalAllTime - (u.totalWithdrawn || 0);
    if (balance < amount) {
      return bot.sendMessage(msg.chat.id, `❌ Saldo insuficiente. Seu saldo disponível é ${balance} HBR.`);
    }

    // Cria solicitação
    const id = uuidv4();
    const req = {
      id,
      telegramId: msg.from.id,
      username: msg.from.username || msg.from.first_name,
      amount,
      wallet: u.wallet,
      createdAt: new Date(),
    };
    storage.addWithdrawal(req);

    bot.sendMessage(msg.chat.id, `✅ Solicitação criada. ID: ${id}. Um admin irá revisar.`);

    // Notificar admin
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      bot.sendMessage(
        ADMIN_ID,
        `📥 *Novo saque*\n\n👤 Usuário: @${req.username}\n🪪 ID: ${req.telegramId}\n💰 Valor: ${amount} HBR\n💼 Wallet: ${req.wallet}\n🆔 Solicitação: ${id}`,
        { parse_mode: "Markdown" }
      ).catch(() => {
        console.log("❌ Não foi possível enviar notificação ao admin. Ele precisa iniciar conversa com o bot no privado.");
      });
    }
  });
}

module.exports = { botUserHandlers };
