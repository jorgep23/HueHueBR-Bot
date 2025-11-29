const { bot } = require("../index");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/users.json");
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));

bot.onText(/\/registrar (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match[1].trim();

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return bot.sendMessage(chatId, "❌ Endereço inválido. Use uma carteira BNB/MetaMask válida.");
  }

  const users = JSON.parse(fs.readFileSync(dataPath));
  users[chatId] = walletAddress;
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

  bot.sendMessage(chatId, `✅ Carteira registrada com sucesso: \`${walletAddress}\``, { parse_mode: "Markdown" });
});
