require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// Cria instância do bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 Bot HueHueBR iniciado...");

// Exporta bot para comandos
module.exports.bot = bot;

// Importa comandos
require("./commands/welcome");
require("./commands/register");
require("./commands/dropCommand");
require("./commands/price");
require("./commands/tokenInfo");
