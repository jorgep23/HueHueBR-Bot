const { bot } = require("../index");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `👋 Olá, ${msg.from.first_name}!\nBem-vindo ao HueHueBR!\nUse /registrar SUA_CARTEIRA para participar dos drops.`
  );
});
