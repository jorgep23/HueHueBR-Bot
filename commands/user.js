// commands/user.js
const storage = require('../services/storage');
const { v4: uuidv4 } = require('uuid');

function botUserHandlers(bot){

  // /price
  bot.onText(/\/price/, async (msg) => {
    const db = await storage.read();
    const p = (db.config && db.config.priceUsd) || 0;
    await bot.sendMessage(msg.chat.id, `💰 Preço HBR: $${p}`);
  });

  // /mypoints
  bot.onText(/\/mypoints/, async (msg) => {
    const u = await storage.getUser(msg.from.id);

    if (!u)
      return bot.sendMessage(msg.chat.id, '❌ Você não está registrado. Use /registrar 0xSuaCarteira (no privado).');

    const balance = u.balance || 0;
    const today = u.totalToday || 0;
    const withdrawn = u.totalWithdrawn || 0; // ainda não existe, será sempre 0

    await bot.sendMessage(
      msg.chat.id,
      `📊 *Seus ganhos*\nHoje: ${today} HBR\nSaldo Atual: ${balance} HBR\nRetirado: ${withdrawn} HBR`,
      { parse_mode: "Markdown" }
    );
  });

  // /registrar (somente no privado)
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];

    if (msg.chat.type !== 'private'){
      return bot.sendMessage(chatId, '🔐 Use este comando em PRIVADO com o bot: /registrar 0xSuaCarteira');
    }

    await storage.setUser(msg.from.id, {
      wallet,
      username: msg.from.username || msg.from.first_name,
      registeredAt: new Date().toISOString()
    });

    await bot.sendMessage(chatId, '✅ Carteira registrada com sucesso!');
  });

  // /withdraw <amount>
  bot.onText(/\/withdraw\s+(\d+)/, async (msg, match) => {

    const amount = Number(match[1]);
    const MIN_WITHDRAW = 50;

    if (!amount || amount <= 0)
      return bot.sendMessage(msg.chat.id, 'Use: /withdraw 100 (quantia em HBR)');

    if (amount < MIN_WITHDRAW) {
      return bot.sendMessage(
        msg.chat.id,
        `⚠️ O valor mínimo para saque é *${MIN_WITHDRAW} HBR*.`,
        { parse_mode: 'Markdown' }
      );
    }

    const u = await storage.getUser(msg.from.id);

    if (!u || !u.wallet)
      return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');

    const balance = u.balance || 0;

    if (balance < amount) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Saldo insuficiente. Seu saldo disponível é ${balance} HBR.`
      );
    }

    // Ainda não existe sistema de requests no storage.
    // Só avisamos o admin (manual)
    const id = uuidv4();

    await bot.sendMessage(
      msg.chat.id,
      `📥 Pedido enviado!\nID: ${id}\nAguarde o admin processar manualmente.`
    );

    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      await bot.sendMessage(
        ADMIN_ID,
        `📥 *Novo Pedido de Saque*\n\nID: ${id}\nUsuário: @${msg.from.username}\nValor: ${amount} HBR\nWallet: ${u.wallet}`,
        { parse_mode: "Markdown" }
      );
    }
  });
}

module.exports = { botUserHandlers };
