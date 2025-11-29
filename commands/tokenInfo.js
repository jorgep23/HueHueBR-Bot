const bot = require("node-telegram-bot-api").default;
const { getPrice } = require("../services/price");

bot.onText(/\/hbr/, async (msg) => {
  const chatId = msg.chat.id;
  const price = await getPrice();

  bot.sendMessage(
    chatId,
    `📊 *Painel HueHueBR (HBR)*\n\n💰 Preço USD: ${price.usd.toFixed(4)}\n💵 Preço BRL: ${price.brl.toFixed(2)}\n💧 HBR/BNB: ${price.bnb.toFixed(6)}`,
    { parse_mode: "Markdown" }
  );
});
