// commands/registrar.js
const storage = require("../services/storage.js");
const { getFounderCount } = require("../services/founders.js");

function botRegisterHandlers(bot) {

  /* ======================================================
     /start — Menu visual e animado
  ====================================================== */
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const text =
      `🤖 *HueHueBR Drop Bot*\n\n` +
      `💸 Receba HBR automaticamente a cada 20 minutos!\n` +
      `👑 Holders da coleção *HueHueBR Founders* recebem bônus!\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Comandos*\n` +
      `🔐 /registrar 0xSuaCarteira  — registrar (privado)\n` +
      `💰 /price  — preço da HBR\n` +
      `📊 /mypoints  — seus ganhos\n` +
      `📤 /withdraw <HBR>  — saque\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `🚀 **Aperte /registrar para começar!**`;

    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });


  /* ======================================================
     /registrar — Apenas privado + visual bonito
  ====================================================== */
  bot.onText(/\/registrar\s+(0x[0-9a-fA-F]{40})/, async (msg, match) => {
    const chatId = msg.chat.id;
    const wallet = match[1].toLowerCase();
    const userName = msg.from.username || msg.from.first_name;

    if (msg.chat.type !== "private") {
      return bot.sendMessage(
        chatId,
        "🔐 Use este comando no *privado* com o bot.",
        { parse_mode: "Markdown" }
      );
    }

    // checar duplicata
    const dup = await storage.findUsersByWallet(wallet);
    if (dup.length > 0) {
      return bot.sendMessage(
        chatId,
        `⚠️ Essa carteira já está registrada.\nSe for um erro, fale com um admin.`,
        { parse_mode: "Markdown" }
      );
    }

    // armazenar usuário
    await storage.setUser(msg.from.id, {
      wallet,
      username: userName,
      registeredAt: new Date().toISOString()
    });

    /* ====== visual do registro ====== */
    await bot.sendMessage(
      chatId,
      `✅ *Carteira registrada com sucesso!*\n\n` +
      `👤 Usuário: @${userName}\n` +
      `💼 Wallet: \`${wallet}\`\n\n` +
      `🎯 Você agora participa dos drops automáticos a cada 20 minutos.`,
      { parse_mode: "Markdown" }
    );

    // Detecta se é Founder e manda mensagem premium
    try {
      const founderCount = await getFounderCount(wallet);
      if (founderCount > 0) {
        await bot.sendMessage(
          chatId,
          `👑 *Parabéns! NFT Founder detectado!*\n\n` +
          `🔥 Você receberá *bônus automático* nos drops baseado na sua quantidade de Founders.\n\n` +
          `Quantidade detectada: *${founderCount}*`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {}


    /* ====== LOG público no grupo ====== */
    const GROUP_ID = process.env.GROUP_ID;
    if (GROUP_ID) {
      try {
        await bot.sendMessage(
          GROUP_ID,
          `📥 @${userName} entrou nos drops!`,
          { parse_mode: "Markdown" }
        );
      } catch (_) {}
    }
  });


  /* ======================================================
     Mensagem automática para novos membros
  ====================================================== */
  bot.on("new_chat_members", async (msg) => {

    for (const member of msg.new_chat_members) {

      const intro =
        `👋 *Bem-vindo(a), ${member.first_name || member.username}!*\n\n` +
        `💸 Para começar a receber *HBR grátis*:\n\n` +
        `1️⃣ Abra o privado com o bot\n` +
        `2️⃣ Envie:\n` +
        `\`/registrar 0xSuaCarteira\`\n\n` +
        `👑 Holders da coleção Founders recebem *bônus a cada drop*!`;

      await bot.sendMessage(msg.chat.id, intro, {
        parse_mode: "Markdown"
      });
    }
  });

}

module.exports = { botRegisterHandlers };
