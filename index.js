const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const app = express();
app.use(express.json());

// Utils
const { web3, tokenContract, nftContract, pairContract } = require("./utils/web3");
const { startAlerts } = require("./utils/alerts");

// Detecta ambiente
const isProd = process.env.NODE_ENV === "production";

// BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: !isProd
});

const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

// ===============================
//      WEBHOOK (Railway)
// ===============================
if (isProd) {
    const WEBHOOK_URL = `${process.env.WEBHOOK_URL}/webhook`;

    bot.setWebHook(WEBHOOK_URL);
    console.log("🌐 Webhook registrado:", WEBHOOK_URL);

    app.post("/webhook", (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
}

// ===============================
//       COMMAND: /start
// ===============================
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `👋 Bem-vindo ao *HueHueBR Bot*!

Funções disponíveis:
/price – Ver preço do HBR
/tokeninfo – Infos do token
/nftinfo – Infos dos NFTs
/mint – Mint de NFTs
/buy – Como comprar
/help – Ajuda`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
//       COMMAND: /price
// ===============================
bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const reserves = await pairContract.methods.getReserves().call();
        const reserve0 = reserves._reserve0;
        const reserve1 = reserves._reserve1;

        const price = (reserve1 / reserve0).toFixed(12);

        bot.sendMessage(chatId, `💰 *Preço HBR/WBNB:* ${price} BNB`, { parse_mode: "Markdown" });
    } catch (e) {
        bot.sendMessage(chatId, "Erro ao buscar preço da pool.");
    }
});

// ===============================
//      COMMAND: /tokeninfo
// ===============================
bot.onText(/\/tokeninfo/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `📘 *Token HueHueBR (HBR)*  
Contrato: \`${process.env.TOKEN_CONTRACT}\`
Rede: BSC  
Supply: 100.000.000 HBR  
Par: HBR/WBNB  
Use /price para ver o preço atual.`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
//      COMMAND: /nftinfo
// ===============================
bot.onText(/\/nftinfo/, async (msg) => {
    try {
        const total = await nftContract.methods.totalSupply().call();

        bot.sendMessage(
            msg.chat.id,
            `🖼 *HueHueBR Founders NFT*
Contrato: \`${process.env.NFT_CONTRACT}\`
Supply mintado: ${total}/500
Funções: boosts, staking, recompensas.

Use /mint para mintar.`,
            { parse_mode: "Markdown" }
        );
    } catch {
        bot.sendMessage(msg.chat.id, "Erro ao buscar informações do NFT.");
    }
});

// ===============================
//       COMMAND: /mint
// ===============================
bot.onText(/\/mint/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const mintPrice = await nftContract.methods.price().call();
        const mintBnB = web3.utils.fromWei(mintPrice, "ether");

        bot.sendMessage(
            chatId,
            `🖼 *Mint de NFT HueHueBR Founders*\n\nPreço: *${mintBnB} BNB* por NFT\n\nEnvie agora para executar o mint:\n\n\`${process.env.NFT_CONTRACT}\``,
            { parse_mode: "Markdown" }
        );
    } catch {
        bot.sendMessage(chatId, "Erro ao buscar preço de mint.");
    }
});

// ===============================
//       COMMAND: /buy
// ===============================
bot.onText(/\/buy/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `💹 *Como comprar HBR:*

1️⃣ Vá na PancakeSwap  
2️⃣ Cole o contrato:  
\`${process.env.TOKEN_CONTRACT}\`  
3️⃣ Par: HBR/WBNB  
4️⃣ Slippage recomendado: 1%–3%

Link direto:  
https://pancakeswap.finance/swap?outputCurrency=${process.env.TOKEN_CONTRACT}`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
//       COMMAND: /help
// ===============================
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `ℹ️ *Ajuda do bot*

/price – Ver preço HBR  
/tokeninfo – Info do token  
/nftinfo – Info dos NFTs  
/mint – Mint de NFT  
/buy – Como comprar`,
        { parse_mode: "Markdown" }
    );
});

// ===============================
//      ALERTAS AUTOMÁTICOS
// ===============================
startAlerts(bot, OWNER_CHAT_ID);

// ===============================
//      SERVIDOR EXPRESS
// ===============================
app.get("/", (req, res) => {
    res.send("HueHueBR Bot funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});

console.log("🤖 HueHueBR Bot rodando...");
