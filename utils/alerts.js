// utils/alerts.js
const { web3, nftContract, pairContract } = require("./web3");

let lastBlockBuy = 0n;
let lastBlockMint = 0n;

// how many blocks to check each interval (keep small to avoid RPC limits)
const BLOCK_RANGE = 2n;
const INTERVAL_MS = 7000;

function safeBlock(bn) {
  return bn < 0n ? 0n : bn;
}

async function startAlerts(bot, chatId) {
  console.log("📡 Alerts started");

  // token buy alerts (listening Swap events from pair)
  setInterval(async () => {
    try {
      const current = BigInt(await web3.eth.getBlockNumber());

      let fromBlock = lastBlockBuy === 0n ? safeBlock(current - BLOCK_RANGE) : lastBlockBuy + 1n;
      let toBlock = current;

      if (toBlock - fromBlock > BLOCK_RANGE) {
        fromBlock = toBlock - BLOCK_RANGE;
      }

      // web3 expects Numbers for block fields
      const events = await pairContract.getPastEvents("Swap", {
        fromBlock: Number(fromBlock),
        toBlock: Number(toBlock)
      });

      if (events && events.length) {
        for (const ev of events) {
          // depending on token ordering in pair, either amount0In/amount1Out or vice-versa indicate buy
          const a0In = BigInt(ev.returnValues.amount0In || "0");
          const a1In = BigInt(ev.returnValues.amount1In || "0");
          const a0Out = BigInt(ev.returnValues.amount0Out || "0");
          const a1Out = BigInt(ev.returnValues.amount1Out || "0");

          // Determine which amounts correspond to HBR/WBNB is non-trivial without token0/token1 check.
          // We assume pair has token0/token1 consistent with on-chain. We'll treat a buy as presence of incoming WBNB and outgoing HBR:
          // buy condition (approx): some amount in on one side and amount out on other side.
          const isBuy = (a0In > 0n && a1Out > 0n) || (a1In > 0n && a0Out > 0n);

          if (isBuy) {
            // safe send
            try {
              await bot.sendMessage(chatId, `💰 *HBR BUY detected*\nBlock: ${ev.blockNumber}\nTx: https://bscscan.com/tx/${ev.transactionHash}`, { parse_mode: "Markdown" });
            } catch (err) {
              // swallow telegram send errors
              console.warn("Warning: telegram send failed:", err?.message || err);
            }
          }
        }
      }

      lastBlockBuy = current;
    } catch (err) {
      // if RPC returns limit exceeded, show advice in logs only
      console.log("Erro monitorando compras:", err.message || err);
    }
  }, INTERVAL_MS);

  // NFT mint alerts (Transfer from 0x0)
  setInterval(async () => {
    try {
      const current = BigInt(await web3.eth.getBlockNumber());

      let fromBlock = lastBlockMint === 0n ? safeBlock(current - BLOCK_RANGE) : lastBlockMint + 1n;
      let toBlock = current;

      if (toBlock - fromBlock > BLOCK_RANGE) {
        fromBlock = toBlock - BLOCK_RANGE;
      }

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
            await bot.sendMessage(chatId, `🎨 *NFT Minted*\nToken ID: ${id}\nTo: ${to}\nTx: https://bscscan.com/tx/${ev.transactionHash}`, { parse_mode: "Markdown" });
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

module.exports = { startAlerts };
