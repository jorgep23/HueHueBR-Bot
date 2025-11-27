const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const { web3, tokenContract, nftContract, pairContract } = require("./utils/web3");
const { startAlerts } = require("./utils/alerts");

const TOKEN = process.env.BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;

// =============================================
// BOT: MODO RAILWAY → WEBHOOK (SEM POLLING)
// =============================================
let bot;

if (process.env.WEBHOOK_URL) {
    bot = new TelegramBot(TOKEN, { webHook: true });
    bot.setWebHook(`${process.env.WEBHOOK_URL}/bot${TOKEN}`);
    console.log("Webhook configurado:", process.env.WEBHOOK_URL);
} else {
    bot = new TelegramBot(TOKEN, { polling: true });
    console.log("Rodando em modo polling (local)...");
}

// =============================================
// COMANDO /start
// =============================================
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

// =============================================
// COMANDO /price
// =============================================
bot.onText(/\/price/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const reserves = await pairContract.methods.getReserves().call();

        const reserve0 = Number(reserves._reserve0);
        const reserve1 = Number(reserves._reserve1);

        if (reserve0 === 0 || reserve1 === 0) {
            return bot.sendMessage(chatId, "Erro: pool sem liquidez suficiente.");
        }

        const price = (reserve1 / reserve0).toFixed(12);

        bot.sendMessage(chatId, `💰 *Preço HBR/WBNB:* ${price} BNB`, {
            parse_mode: "Markdown",
        });
    } catch (e) {
        console.log("Erro /price:", e.message);
        bot.sendMessage(chatId, "Erro ao buscar preço da pool.");
    }
});

// =============================================
// COMANDO /tokeninfo
// =============================================
bot.onText(/\/tokeninfo/, async (msg) => {
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

// =============================================
// COMANDO /nftinfo
// =============================================
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
    } catch (e) {
        console.log("Erro /nftinfo:", e.message);
        bot.sendMessage(msg.chat.id, "Erro ao buscar informações do NFT.");
    }
});

// =============================================
// COMANDO /mint
// =============================================
bot.onText(/\/mint/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const mintPrice = await nftContract.methods.price().call();
        const mintBnB = web3.utils.fromWei(String(mintPrice), "ether");

        bot.sendMessage(
            chatId,
            `🖼 *Mint de NFT HueHueBR Founders*

Preço: *${mintBnB} BNB* por NFT

Envie agora para executar o mint:
\`${process.env.NFT_CONTRACT}\``,
            { parse_mode: "Markdown" }
        );
    } catch (e) {
        console.log("Erro /mint:", e.message);
        bot.sendMessage(chatId, "Erro ao buscar preço de mint.");
    }
});

// =============================================
// COMANDO /buy
// =============================================
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

// =============================================
// COMANDO /help
// =============================================
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `ℹ️ *Ajuda do bot*

/price – Ver preço HBR
/tokeninfo – Info do token
/nftinfo – Info dos NFTs
/mint – Mint de NFT
/buy – Como comprar`
    );
});

// =============================================
// ⚡ MONITORES AUTOMÁTICOS
// =============================================
startAlerts(bot, OWNER_CHAT_ID);

console.log("🤖 HueHueBR Bot rodando...");
