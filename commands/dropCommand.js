const { bot } = require("../index");
const { sendDrop } = require("../services/drop");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/users.json");

bot.onText(/\/drop (.+)/, async (msg, match) => {
  if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

  const chatId = msg.chat.id;
  const amount = Number(match[1]);
  const users = JSON.parse(fs.readFileSync(dataPath));

  bot.sendMessage(chatId, "🎁 Iniciando DROP...");

  for (const [chat, wallet] of Object.entries(users)) {
    const result = await sendDrop(wallet, amount);

    if (result.success) {
      bot.sendMessage(chatId, `🎉 DROP enviado para [link](tg://user?id=${chat})\n💳 Carteira: \`${wallet}\`\n💰 Quantia: ${amount} HBR\n🔗 Hash: \`${result.txHash}\``, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `⚠ Erro ao enviar para ${wallet}: ${result.error}`);
    }
  }
});
