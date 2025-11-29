require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot HueHueBR iniciado...");

// Exporta a instância para os comandos
module.exports.bot = bot;

// Importa os comandos depois de criar o bot
require("./commands/welcome");
require("./commands/register");
require("./commands/tokenInfo");
require("./commands/dropCommand");

