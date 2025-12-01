const { bot } = require("../index");
const { getPrice } = require("../services/price");

bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;

  let price = await getPrice();
  price = Number(price) || 0;

  bot.sendMessage(chatId, `💰 Preço HBR: $${price.toFixed(8)} BNB`);
});
