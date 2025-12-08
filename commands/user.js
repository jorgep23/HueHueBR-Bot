// commands/user.js
const storage = require("../services/storage.js");
const { getHbrPriceUsd } = require("../services/pancakeswap.js");
const { v4: uuidv4 } = require("uuid");

function botUserHandlers(bot) {

  /* ========================= PRICE ========================= */

  bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const price = await getHbrPriceUsd(process.env.HBR_CONTRACT);

      await bot.sendMessage(
        chatId,
        `💰 *Preço HBR (real-time):* $${price.toFixed(8)}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      await bot.sendMessage(chatId, "⚠️ Erro ao consultar preço.");
    }
  });


  /* ========================= MYPOINTS ========================= */

  bot.onText(/\/mypoints/, async (msg) => {
    const chatId = msg.chat.id;
    const u = await storage.getUser(msg.from.id);

    if (!u)
      return bot.sendMessage(chatId, "❌ Você não está registrado. Use /registrar 0xSuaCarteira");

    const balance = u.balance || 0;
    const today = u.totalToday || 0;
    const total = u.totalAllTime || 0;
    const withdrawn = u.totalWithdrawn || 0;

    await bot.sendMessage(
      chatId,
      `📊 *Seus ganhos*\n\n` +
      `🟢 Hoje: ${today} HBR\n` +
      `📦 Saldo: ${balance} HBR\n` +
      `📈 Total recebido: ${total} HBR\n` +
      `💸 Retirado: ${withdrawn} HBR`,
      { parse_mode: "Markdown" }
    );
  });


  /* ========================= REGISTRAR ========================= */

  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];

    if (msg.chat.type !== "private")
      return bot.sendMessage(chatId, "🔐 Use este comando em PRIVADO com o bot.");

    // anti-duplicado
    const dup = await storage.findUsersByWallet(wallet);
    if (dup.length > 0) {
      await bot.sendMessage(
        chatId,
        `⚠️ Essa carteira já está registrada.\nSe isso for um erro, contate um admin.`
      );
    }

    await storage.setUser(msg.from.id, {
      wallet,
      username: msg.from.username || msg.from.first_name,
      registeredAt: new Date().toISOString()
    });

    await bot.sendMessage(chatId, "✅ Carteira registrada com sucesso!");
  });


  /* ========================= WITHDRAW ========================= */

  bot.onText(/\/withdraw\s+(\d+)/, async (msg, match) => {

    const chatId = msg.chat.id;
    const amount = Number(match[1]);
    const MIN_WITHDRAW = 50;

    if (!amount || amount <= 0)
      return bot.sendMessage(chatId, "Use: /withdraw <quantia>");

    if (amount < MIN_WITHDRAW) {
      return bot.sendMessage(
        chatId,
        `⚠️ O valor mínimo para saque é *${MIN_WITHDRAW} HBR*.`,
        { parse_mode: "Markdown" }
      );
    }

    const u = await storage.getUser(msg.from.id);

    if (!u || !u.wallet)
      return bot.sendMessage(chatId, "❌ Registre sua carteira primeiro. /registrar 0x...");

    const balance = u.balance || 0;
    if (balance < amount)
      return bot.sendMessage(chatId, `❌ Saldo insuficiente. Seu saldo é ${balance} HBR.`);


    // 🔥 Aqui está a correção REAL
    // agora grava no DB!
    const id = uuidv4();
    const req = {
      id,
      telegramId: msg.from.id,
      username: msg.from.username || msg.from.first_name,
      amount,
      wallet: u.wallet,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await storage.addWithdrawal(req);

    await bot.sendMessage(
      chatId,
      `📥 Pedido de saque criado!\nID: ${id}\nUm admin irá revisar.`
    );

    // avisa admin
    const ADMIN_ID = process.env.ADMIN_ID;
    if (ADMIN_ID) {
      await bot.sendMessage(
        ADMIN_ID,
        `📥 *Novo Pedido de Saque*\n\n` +
        `ID: ${id}\n` +
        `Usuário: @${req.username}\n` +
        `Valor: ${amount} HBR\n` +
        `Wallet: \`${req.wallet}\``,
        { parse_mode: "Markdown" }
      );
    }
  });

}

module.exports = { botUserHandlers };

module.exports = { botUserHandlers };
