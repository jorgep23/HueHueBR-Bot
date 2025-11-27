require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { startAlerts } = require("./utils/alerts");
const { web3, nftContract, pairContract } = require("./utils/web3");
const { getV3Price } = require("./utils/price");

const app = express();

// ============================
// VARIÁVEIS DO .env
// ============================
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.OWNER_CHAT_ID;
const POOL_V3 = process.env.POOL_V3;
const RPC_URL = process.env.RPC_URL;

if (!TOKEN || !CHAT_ID || !POOL_V3 || !RPC_URL) {
    console.error("❌ Verifique BOT_TOKEN, OWNER_CHAT_ID, POOL_V3 e RPC_URL no .env");
    process.exit(1);
}

// ============================
// BOT EM MODO POLLING
// ============================
const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot iniciado em modo POLLING...");

// Mensagem padrão
bot.on("message", (msg) => {
    //bot.sendMessage(msg.chat.id, "Bot está rodando! Monitoramento ativo.");
});

// ============================
// ALERTS AUTOMÁTICOS
// ============================
startAlerts(bot, CHAT_ID);
console.log("📡 Alerts started");

// ============================
// COMMAND: /start
// ============================
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

// ============================
// COMMAND: /price (PancakeSwap V3)
// ============================
bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const poolAddress = process.env.PAIR_CONTRACT; // endereço V3
        const { price, token0, token1 } = await getV3Price(poolAddress);

        bot.sendMessage(
            chatId,
            `💰 *Preço HBR/VBNB (V3):* ${price.toFixed(12)} (${token0}/${token1})`,
            { parse_mode: "Markdown" }
        );
    } catch (err) {
        console.error("Erro no /price:", err.message || err);
        bot.sendMessage(chatId, "Erro no /price: verifique RPC, endereço da pool e logs do servidor.");
    }
});


// ============================
// COMMAND: /tokeninfo
// ============================
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
// COMMAND: /nftinfo
// ===============================
bot.onText(/\/nftinfo/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // pega eventos Transfer do contrato
        const events = await nftContract.getPastEvents("Transfer", {
            filter: { from: "0x0000000000000000000000000000000000000000" },
            fromBlock: 0,
            toBlock: "latest"
        });

        const totalMinted = events.length;

        bot.sendMessage(
            chatId,
            `🖼 *HueHueBR Founders NFT*
Contrato: \`${process.env.NFT_CONTRACT}\`
Supply mintado: ${totalMinted}/500
Funções: boosts, staking, recompensas.

Use /mint para mintar.`,
            { parse_mode: "Markdown" }
        );
    } catch (err) {
        console.error("Erro ao buscar informações do NFT:", err.message || err);
        bot.sendMessage(chatId, "❌ Erro ao buscar informações do NFT. Verifique contrato e RPC.");
    }
});



// ============================
// COMMAND: /mint
// ============================
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

// ============================
// COMMAND: /buy
// ============================
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

// ============================
// COMMAND: /help
// ============================
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

// ============================
// SERVIDOR EXPRESS
// ============================
app.get("/", (req, res) => {
    res.send("HueHueBR Bot funcionando!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});
