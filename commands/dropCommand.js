const { bot } = require("../index");
const { sendDrop } = require("../services/drop");

bot.onText(/\/drop (\d+) (\w+)/, async (msg, match) => {
  if (msg.from.id != process.env.ADMIN_ID) return;

  const chatId = msg.chat.id;
  const amount = Number(match[1]);
  const wallet = match[2];

  const result = await sendDrop(wallet, amount);

  if (result.success) {
    bot.sendMessage(chatId, `🎉 Drop enviado!\n💳 Carteira: ${wallet}\n💰 Quantia: ${amount} HBR\n🔗 Tx: ${result.txHash}`);
  } else {
    bot.sendMessage(chatId, `⚠ Erro: ${result.error}`);
  }
});
