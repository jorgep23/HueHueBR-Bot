// services/pancakeswap.js
// Requer ethers v6
const { JsonRpcProvider, Contract } = require('ethers');

const PCS_ROUTER = process.env.PCS_ROUTER || "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const BUSD_ADDRESS = process.env.BUSD_ADDRESS || "0xe9e7cea3dedca5984780bafc599bd69add087d56"; // BUSD oficial
const BSC_RPC = process.env.BSC_RPC || "https://bsc-dataseed.binance.org/";

const provider = new JsonRpcProvider(BSC_RPC);

// Minimal ABI for getAmountsOut
const ABI = ["function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"];

// Simple cache to avoid spamming RPC
let _cached = { price: null, ts: 0 };

async function getHbrPriceUsd(hbrAddress, busdAddress = BUSD_ADDRESS) {
  try {
    // if cache is recent (60s), return it
    const now = Date.now();
    if (_cached.price && (now - _cached.ts) < 60 * 1000) return _cached.price;

    if (!hbrAddress) {
      console.warn("getHbrPriceUsd: missing HBR_CONTRACT env var");
      return null;
    }

    const router = new Contract(PCS_ROUTER, ABI, provider);
    // 1 HBR with 18 decimals
    const amountIn = BigInt(10) ** BigInt(18);

    // getAmountsOut returns BigNumber[]; Contract will return JS BigInt in v6
    const amounts = await router.getAmountsOut(amountIn, [hbrAddress, busdAddress]);
    // amounts[1] is amount of BUSD (18 decimals)
    const amountOut = amounts[1];
    // convert BigInt to number safely (may lose precision for huge values — fine for price)
    const price = Number(amountOut) / 1e18;

    // cache and return
    _cached = { price, ts: now };
    return price;
  } catch (err) {
    console.warn("getHbrPriceUsd error:", err && err.message ? err.message : err);
    return null;
  }
}

module.exports = { getHbrPriceUsd };
