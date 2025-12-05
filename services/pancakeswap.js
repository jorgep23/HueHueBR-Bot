// services/pancakeswap.js
const { JsonRpcProvider, Contract } = require('ethers');

const PCS_ROUTER = process.env.PCS_ROUTER || "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const BUSD = process.env.BUSD_ADDRESS || "0xe9e7cea3dedca5984780bafc599bd69add087d56";
const WBNB = process.env.WBNB_ADDRESS || "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const RPC = process.env.BSC_RPC || "https://bsc-dataseed.binance.org/";

const provider = new JsonRpcProvider(RPC);

// getAmountsOut ABI
const ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)"
];

let cache = { price: null, ts: 0 };

async function getHbrPriceUsd(hbrAddress) {
  try {
    if (!hbrAddress) {
      console.warn("⚠ getHbrPriceUsd: HBR_CONTRACT não definido!");
      return null;
    }

    const now = Date.now();
    if (cache.price && now - cache.ts < 60_000) return cache.price;

    const router = new Contract(PCS_ROUTER, ABI, provider);

    // 1 HBR com 18 decimais
    const amountIn = BigInt(10) ** BigInt(18);

    // ROTA CORRETA: HBR → WBNB → BUSD
    const path = [hbrAddress, WBNB, BUSD];

    const amounts = await router.getAmountsOut(amountIn, path);

    if (!amounts || !amounts[amounts.length - 1]) {
      console.warn("⚠ getAmountsOut retornou vazio");
      return null;
    }

    // Valor final (BUSD)
    const busd = Number(amounts[amounts.length - 1]) / 1e18;

    cache = { price: busd, ts: now };

    return busd;
  } catch (e) {
    console.error("❌ Erro getHbrPriceUsd:", e.message);
    return null;
  }
}

module.exports = { getHbrPriceUsd };
