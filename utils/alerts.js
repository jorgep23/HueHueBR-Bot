const { web3, nftContract, pairContract } = require("./web3");

let lastBlockBuy = 0n;
let lastBlockMint = 0n;

// Evita blocos negativos
function safeBlock(bn) {
    return bn < 0n ? 0n : bn;
}

// Evita consultas muito grandes (máximo 2 blocos por ciclo)
const BLOCK_RANGE = 2n;

async function startAlerts(bot, chatId) {
    console.log("📡 Monitoramento ativo...");

    // ==============================
    //     ALERTA DE COMPRA HBR
    // ==============================
    setInterval(async () => {
        try {
            const currentBlock = BigInt(await web3.eth.getBlockNumber());

            let fromBlock = lastBlockBuy === 0n
                ? safeBlock(currentBlock - BLOCK_RANGE)
                : lastBlockBuy + 1n;

            let toBlock = currentBlock;

            // Limite de faixa
            if (toBlock - fromBlock > BLOCK_RANGE) {
                fromBlock = toBlock - BLOCK_RANGE;
            }

            const events = await pairContract.getPastEvents("Swap", {
                fromBlock: Number(fromBlock),
                toBlock: Number(toBlock)
            });

            if (events.length > 0) {
                for (let ev of events) {
                    const amount0In = BigInt(ev.returnValues.amount0In || 0);
                    const amount1Out = BigInt(ev.returnValues.amount1Out || 0);

                    // Compra quando entra WBNB e sai HBR
                    const isBuy = amount0In > 0n && amount1Out > 0n;

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
            }

            lastBlockBuy = currentBlock;

        } catch (err) {
            console.log("🚨 Erro monitorando compras:", err.message);
        }
    }, 6000);

    // ==============================
    //       ALERTA DE MINT NFT
    // ==============================
    setInterval(async () => {
        try {
            const currentBlock = BigInt(await web3.eth.getBlockNumber());

            let fromBlock = lastBlockMint === 0n
                ? safeBlock(currentBlock - BLOCK_RANGE)
                : lastBlockMint + 1n;

            let toBlock = currentBlock;

            if (toBlock - fromBlock > BLOCK_RANGE) {
                fromBlock = toBlock - BLOCK_RANGE;
            }

            const mints = await nftContract.getPastEvents("Transfer", {
                filter: { from: "0x0000000000000000000000000000000000000000" },
                fromBlock: Number(fromBlock),
                toBlock: Number(toBlock)
            });

            if (mints.length > 0) {
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
            }

            lastBlockMint = currentBlock;

        } catch (err) {
            console.log("🚨 Erro monitorando mint NFT:", err.message);
        }
    }, 6000);
}

module.exports = { startAlerts };
