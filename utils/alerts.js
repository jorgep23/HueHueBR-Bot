// utils/alerts.js
const { web3, nftContract, pairContract } = require("./web3");

let lastBlockBuy = 0n;
let lastBlockMint = 0n;

// Configurações
const BLOCK_RANGE = 1n; // blocos por chamada
const INTERVAL_MS = 20000; // 20s
let nftCache = { totalMinted: 0, timestamp: 0 }; // cache para NFT

function safeBlock(bn) {
  return bn < 0n ? 0n : bn;
}

// Função para contar NFTs mintados com paginação
async function getTotalMinted() {
  const now = Date.now();
  if (now - nftCache.timestamp < 60000) return nftCache.totalMinted; // 1 min cache

  const latestBlock = await web3.eth.getBlockNumber();
  const step = 500; // blocos por chamada
  let totalMinted = 0;

  for (let from = 0; from <= latestBlock; from += step) {
    const to = Math.min(from + step, latestBlock);
    try {
      const events = await nftContract.getPastEvents("Transfer", {
        filter: { from: "0x0000000000000000000000000000000000000000" },
        fromBlock: from,
        toBlock: to
      });
      totalMinted += events.length;
    } catch (err) {
      console.warn(`Erro ao buscar eventos de ${from} a ${to}:`, err.message || err);
    }
  }

  nftCache = { totalMinted, timestamp: now };
  return totalMinted;
}

async function startAlerts(bot, chatId) {
  console.log("📡 Alerts started");

  // Token buy alerts
  setInterval(async () => {
    try {
      const current = BigInt(await web3.eth.getBlockNumber());
      let fromBlock = lastBlockBuy === 0n ? safeBlock(current - BLOCK_RANGE) : lastBlockBuy + 1n;
      let toBlock = current;
      if (toBlock - fromBlock > BLOCK_RANGE) fromBlock = toBlock - BLOCK_RANGE;

      const events = await pairContract.getPastEvents("Swap", {
        fromBlock: Number(fromBlock),
        toBlock: Number(toBlock)
      });

      if (events && events.length) {
        for (const ev of events) {
          const a0In = BigInt(ev.returnValues.amount0In || "0");
          const a1In = BigInt(ev.returnValues.amount1In || "0");
          const a0Out = BigInt(ev.returnValues.amount0Out || "0");
          const a1Out = BigInt(ev.returnValues.amount1Out || "0");

          const isBuy = (a0In > 0n && a1Out > 0n) || (a1In > 0n && a0Out > 0n);

          if (isBuy) {
            try {
              await bot.sendMessage(
                chatId,
                `💰 HBR BUY detected\nBlock: ${ev.blockNumber}\nTx: https://bscscan.com/tx/${ev.transactionHash}`,
                { parse_mode: "Markdown" }
              );
            } catch (err) {
              console.warn("Warning: telegram send failed:", err?.message || err);
            }
          }
        }
      }
      lastBlockBuy = current;
    } catch (err) {
      console.log("Erro monitorando compras:", err.message || err);
    }
  }, INTERVAL_MS);

  // NFT mint alerts
  setInterval(async () => {
    try {
      const current = BigInt(await web3.eth.getBlockNumber());
      let fromBlock = lastBlockMint === 0n ? safeBlock(current - BLOCK_RANGE) : lastBlockMint + 1n;
      let toBlock = current;
      if (toBlock - fromBlock > BLOCK_RANGE) fromBlock = toBlock - BLOCK_RANGE;

      const mints = await nftContract.getPastEvents("Transfer", {
        filter: { from: "0x0000000000000000000000000000000000000000" },
        fromBlock: Number(fromBlock),
        toBlock: Number(toBlock)
      });

      if (mints && mints.length) {
        for (const ev of mints) {
          const to = ev.returnValues.to;
          const id = ev.returnValues.tokenId;
          try {
            await bot.sendMessage(
              chatId,
              `🎨 NFT Minted\nToken ID: ${id}\nTo: ${to}\nTx: https://bscscan.com/tx/${ev.transactionHash}`,
              { parse_mode: "Markdown" }
            );
          } catch (err) {
            console.warn("Warning: telegram send failed:", err?.message || err);
          }
        }
      }
      lastBlockMint = current;
    } catch (err) {
      console.log("Erro monitorando mint de NFT:", err.message || err);
    }
  }, INTERVAL_MS);
}

module.exports = { startAlerts, getTotalMinted };
