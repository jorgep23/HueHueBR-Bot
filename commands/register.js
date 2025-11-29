const { bot } = require("../index");
const fs = require("fs");
const path = require("path");

// Caminho para salvar usuários e suas carteiras
const dataPath = path.join(__dirname, "../data/users.json");

// Cria arquivo se não existir
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));

bot.onText(/\/registrar (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match[1].trim();

  // Validação do endereço
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return bot.sendMessage(chatId, "❌ Endereço inválido. Use uma carteira BNB/MetaMask válida.");
  }

  // Salva no JSON
  const users = JSON.parse(fs.readFileSync(dataPath));
  users[chatId] = walletAddress;
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));

  bot.sendMessage(chatId, `✅ Carteira registrada com sucesso: \`${walletAddress}\``, { parse_mode: "Markdown" });
});
