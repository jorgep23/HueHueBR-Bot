const { web3, nftContract, pairContract } = require("./web3");

let lastBlockBuy = 0n;
let lastBlockMint = 0n;

function safeBlock(num) {
    return num < 0n ? 0n : num;
}

async function startAlerts(bot, chatId) {
    console.log("📡 Monitoramento iniciado...");

    // ========= COMPRA DE TOKEN ==========
    setInterval(async () => {
        try {
            const currentBlock = BigInt(await web3.eth.getBlockNumber());

            const fromBlock =
                lastBlockBuy === 0n
                    ? safeBlock(currentBlock - 5n)
                    : lastBlockBuy + 1n;

            const events = await pairContract.getPastEvents("Swap", {
                fromBlock: Number(fromBlock),
                toBlock: "latest",
            });

            for (let ev of events) {
                const { amount0In, amount1Out } = ev.returnValues;

                const isBuy =
                    BigInt(amount0In) > 0n && BigInt(amount1Out) > 0n;

                if (isBuy) {
                    bot.sendMessage(
                        chatId,
                        `💰 *COMPRA DETECTADA!*\n\n` +
                            `Bloco: ${ev.blockNumber}\n` +
                            `Tx: https://bscscan.com/tx/${ev.transactionHash}`,
                        { parse_mode: "Markdown" }
                    );
                }
            }

            lastBlockBuy = currentBlock;
        } catch (err) {
            console.log("Erro monitorando compras:", err.message);
        }
    }, 8000);

    // ========= MINT DE NFT ==========
    setInterval(async () => {
        try {
            const currentBlock = BigInt(await web3.eth.getBlockNumber());

            const fromBlock =
                lastBlockMint === 0n
                    ? safeBlock(currentBlock - 5n)
                    : lastBlockMint + 1n;

            const mints = await nftContract.getPastEvents("Transfer", {
                filter: { from: "0x0000000000000000000000000000000000000000" },
                fromBlock: Number(fromBlock),
                toBlock: "latest",
            });

            for (let ev of mints) {
                const to = ev.returnValues.to;
                const id = ev.returnValues.tokenId;

                bot.sendMessage(
                    chatId,
                    `🎨 *NOVO NFT MINTADO!*\n\n` +
                        `ID: ${id}\n` +
                        `Para: ${to}\n` +
                        `Tx: https://bscscan.com/tx/${ev.transactionHash}`,
                    { parse_mode: "Markdown" }
                );
            }

            lastBlockMint = currentBlock;
        } catch (err) {
            console.log("Erro monitorando mint de NFT:", err.message);
        }
    }, 8000);
}

module.exports = { startAlerts };
