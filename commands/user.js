// commands/user.js
const storage = require("../services/storage.js");
const { getHbrPriceUsd } = require("../services/pancakeswap.js");
const { getFounderCount } = require("../services/founders.js");
const { v4: uuidv4 } = require("uuid");

function botUserHandlers(bot) {

  /* ======================================================
     /price — Preço bonito e formatado
  ====================================================== */
  bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const price = await getHbrPriceUsd(process.env.HBR_CONTRACT);
      const p = price.toFixed(8);

      await bot.sendMessage(
        chatId,
        `💰 *Preço HBR (tempo real)*\n\n` +
        `🔥 \`$${p}\` USD`,
        { parse_mode: "Markdown" }
      );

    } catch (err) {
      await bot.sendMessage(chatId, "⚠️ Erro ao consultar preço da HBR.");
    }
  });


  /* ======================================================
     /mypoints — Diferenciado se for Founder
  ====================================================== */
  bot.onText(/\/mypoints/, async (msg) => {
    const chatId = msg.chat.id;
    const u = await storage.getUser(msg.from.id);

    if (!u)
      return bot.sendMessage(
        chatId,
        "❌ Você não está registrado.\nUse `/registrar 0xSuaCarteira` (no privado).",
        { parse_mode: "Markdown" }
      );

    // format values
    const balance   = (u.balance || 0).toFixed(4);
    const today     = (u.totalToday || 0).toFixed(4);
    const withdrawn = (u.totalWithdrawn || 0).toFixed(4);

    // founder check
    const wallet = String(u.wallet || "").trim();
    const founderCount = await getFounderCount(wallet);

    if (founderCount > 0) {
      /* ---------- VISUAL FOUNDER ---------- */
      return bot.sendMessage(
        chatId,
        `🚀🚀🚀\n` +
        `*👑 CONTA FOUNDER*\n` +
        `🚀🚀🚀\n\n` +
        `👤 Usuário: @${u.username}\n` +
        `💼 Wallet: \`${wallet}\`\n` +
        `👑 NFTs Founders: *${founderCount}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📊 *Ganhos Hoje:* \`${today} HBR\`\n` +
        `💰 *Saldo Atual:* \`${balance} HBR\`\n` +
        `📤 *Retirado:* \`${withdrawn} HBR\`\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🔥 Você está recebendo *bônus automático* nos drops!`,
        { parse_mode: "Markdown" }
      );
    }

    /* ---------- USUÁRIO NORMAL ---------- */
    await bot.sendMessage(
      chatId,
      `📊 *Seus ganhos*\n\n` +
      `👤 Usuário: @${u.username}\n` +
      `💼 Wallet: \`${wallet}\`\n\n` +
      `📦 Hoje: \`${today} HBR\`\n` +
      `💰 Saldo: \`${balance} HBR\`\n` +
      `📤 Retirado: \`${withdrawn} HBR\``,
      { parse_mode: "Markdown" }
    );
  });


  /* ======================================================
     /registrar — Agora com visual e anti-duplicação
  ====================================================== */
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1];

    if (msg.chat.type !== "private")
      return bot.sendMessage(chatId, "🔐 Use este comando *no privado* com o bot.", { parse_mode: "Markdown" });

    const existing = await storage.findUsersByWallet(wallet.toLowerCase());
    if (existing.length > 0) {
      return bot.sendMessage(
        chatId,
        "⚠️ Essa carteira já está registrada em outra conta.\nSe for erro, fale com um admin.",
      );
    }

    await storage.setUser(msg.from.id, {
      wallet: wallet.toLowerCase(),
      username: msg.from.username || msg.from.first_name,
      registeredAt: new Date().toISOString()
    });

    await bot.sendMessage(
      chatId,
      `✅ *Carteira registrada!*\n\n` +
      `👤 Usuário: @${msg.from.username}\n` +
      `💼 Wallet: \`${wallet}\`\n\n` +
      `Agora você está participando dos drops automáticos.`,
      { parse_mode: "Markdown" }
    );
  });


  /* ======================================================
     /withdraw — Mantido porém melhorado visualmente
  ====================================================== */
  bot.onText(/\/withdraw\s+(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = Number(match[1]);
    const MIN = 50;

    if (!amount || amount <= 0)
      return bot.sendMessage(chatId, "Use: /withdraw <quantia>");

    if (amount < MIN)
      return bot.sendMessage(chatId, `⚠️ Mínimo para saque: *${MIN} HBR*`, { parse_mode: "Markdown" });

    const u = await storage.getUser(msg.from.id);
    if (!u || !u.wallet)
      return bot.sendMessage(chatId, "❌ Registre sua carteira primeiro: /registrar 0x...");

    const balance = u.balance || 0;
    if (balance < amount)
      return bot.sendMessage(chatId, `❌ Saldo insuficiente. Saldo atual: ${balance} HBR.`);

    const id = uuidv4();

    await storage.addWithdrawal({
      id,
      telegramId: msg.from.id,
      username: msg.from.username || msg.from.first_name,
      amount,
      wallet: u.wallet,
      status: "pending",
      createdAt: new Date().toISOString()
    });

    await bot.sendMessage(chatId, `📥 *Saque registrado!* ID: \`${id}\``, { parse_mode: "Markdown" });

    const ADMIN = process.env.ADMIN_ID;
    if (ADMIN) {
      await bot.sendMessage(
        ADMIN,
        `📥 *Novo Saque*\n\n` +
        `ID: ${id}\n` +
        `👤 @${msg.from.username}\n` +
        `💰 ${amount} HBR\n` +
        `💼 \`${u.wallet}\``,
        { parse_mode: "Markdown" }
      );
    }
  });

}

module.exports = { botUserHandlers };
