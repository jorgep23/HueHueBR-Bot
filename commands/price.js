const { bot } = require("../index");
const { getPrice } = require("../services/priceService");

bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;
  const price = await getPrice();

  bot.sendMessage(chatId, `💰 Preço HBR: ${price.toFixed(8)} USD`);
});
