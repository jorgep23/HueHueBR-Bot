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

    const today = u.totalToday || 0;
    const all = u.totalAllTime || 0;
    const withdrawn = u.totalWithdrawn || 0;

    await bot.sendMessage(
      msg.chat.id,
      `📊 *Seus ganhos*\nHoje: ${today} HBR\nTotal: ${all} HBR\nRetirado: ${withdrawn} HBR`,
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
      registeredAt: new Date().toISOString(),
      weight: 1
    });

    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID){
      await storage.addPublicLog({
        text: `📥 @${msg.from.username || msg.from.first_name} entrou nos drops.`
      });
    }
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
        `⚠️ O valor mínimo para saque é *${MIN_WITHDRAW} HBR*.\nEnvie /withdraw <quantia> acima deste valor.`,
        { parse_mode: 'Markdown' }
      );
    }

    const u = await storage.getUser(msg.from.id);  // <-- PRECISA DO await

    if (!u || !u.wallet)
      return bot.sendMessage(msg.chat.id, '❌ Você precisa registrar sua carteira antes de solicitar saque.');

    // bloqueado?
    const blocked = await storage.isBlocked(msg.from.id);
    if (blocked) {
      return bot.sendMessage(msg.chat.id, '🚫 Sua conta está bloqueada por suspeita. Contate um admin.');
    }

    // calcula saldo
    const balance = (u.totalAllTime || 0) - (u.totalWithdrawn || 0);
    if (balance < amount) {
      await storage.recordAttempt(msg.from.id, 'withdraw_fail_insufficient');
      return bot.sendMessage(msg.chat.id, `❌ Saldo insuficiente. Seu saldo disponível é ${balance} HBR.`);
    }

    // cria requisição
    const id = uuidv4();
    const req = {
      id,
      telegramId: msg.from.id,
      username: msg.from.username || msg.from.first_name,
      amount,
      wallet: u.wallet,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await storage.addWithdrawal(req);

    await bot.sendMessage(msg.chat.id, `✅ Solicitação criada.\nID: ${id}\nUm admin irá revisar.`);

    // avisa o admin
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      try {
        await bot.sendMessage(
          ADMIN_ID,
          `📥 *Novo Pedido de Saque*\n\nID: ${id}\nUsuário: @${req.username}\nValor: ${amount} HBR\nWallet: ${req.wallet}`,
          { parse_mode: "Markdown" }
        );
      } catch(e) {
        console.log("Admin DM falhou. O admin precisa iniciar o bot.");
      }
    }
  });
}

module.exports = { botUserHandlers };
