const { bot } = require("../index");
const { getPrice } = require("../services/priceService");

bot.onText(/\/tokenInfo/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const info = await getPrice();
    bot.sendMessage(chatId,
      `📊 Token HueHueBR (HBR)\n\n` +
      `💰 Preço USD: $${info.usd}\n` +
      `💵 Preço BRL: R$${info.brl}\n` +
      `📈 MarketCap: ${info.marketcap}\n` +
      `💧 Liquidez: ${info.liquidity}\n` +
      `👥 Holders: ${info.holders}`
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Erro ao obter informações: ${err.message}`);
  }
});
