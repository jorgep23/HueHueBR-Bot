const { bot } = require("../index");
const { getPrice } = require("../services/priceService");

bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const price = await getPrice();
    bot.sendMessage(chatId, `💰 Preço HBR: $${price.usd}\n💰 BRL: R$${price.brl}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Erro ao obter preço: ${err.message}`);
  }
});
