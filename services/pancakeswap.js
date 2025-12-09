// services/pancakeswap.js

const { ethers } = require("ethers");
const { getHbrPriceFromCoingecko } = require("./coingecko");

// RPC (BSC)
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

// Pool oficial HBR/WBNB
const PAIR_ADDRESS = "0xccc3e095bebbef74d140e3a9330f980873263d17";

// WBNB
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

// ABI simples para pool Uniswap V2
const pairAbi = [
  "function getReserves() external view returns (uint112,uint112,uint32)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

/* ============================================================
   CACHE (evita pegar preço toda hora)
============================================================ */
let cachePriceUsd = null;
let cacheTime = 0;
const CACHE_MS = 30_000;  // 30s


/* ============================================================
   GET PRICE FROM PANCAKESWAP
============================================================ */
async function getHbrPriceFromPancake(hbrAddress) {
  try {
    const pair = new ethers.Contract(PAIR_ADDRESS, pairAbi, provider);

    const token0 = (await pair.token0()).toLowerCase();
    const token1 = (await pair.token1()).toLowerCase();
    const hbr = hbrAddress.toLowerCase();

    if (token0 !== hbr && token1 !== hbr) {
      console.error("❌ ERRO: token HBR não está nesse par");
      return null;
    }

    const [r0, r1] = await pair.getReserves();

    let reserveHBR, reserveWBNB;
    if (token0 === hbr) {
      reserveHBR = Number(r0);
      reserveWBNB = Number(r1);
    } else {
      reserveHBR = Number(r1);
      reserveWBNB = Number(r0);
    }

    if (!reserveHBR || !reserveWBNB) return null;

    const priceInBNB = reserveWBNB / reserveHBR;

    /* Binance price */
    let bnbUsd = null;
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
      const json = await res.json();
      if (json?.price) bnbUsd = Number(json.price);
    } catch (_) {}

    if (!bnbUsd) return null;

    const usd = priceInBNB * bnbUsd;
    return Number(usd);

  } catch (err) {
    console.error("⚠️ getHbrPriceFromPancake error:", err.message);
    return null;
  }
}


/* ============================================================
   MAIN GET PRICE FUNCTION (with fallback)
============================================================ */
async function getHbrPriceUsd(hbrAddress) {

  // ---- CACHE
  const now = Date.now();
  if (cachePriceUsd && now - cacheTime < CACHE_MS) {
    return cachePriceUsd;
  }

  // 1) Pancake AMM
  let price = await getHbrPriceFromPancake(hbrAddress);

  // 2) Coingecko fallback
  if (!price || price <= 0) {
    const cg = await getHbrPriceFromCoingecko(hbrAddress);
    if (cg && cg > 0) price = cg;
  }

  // 3) ultimate fallback
  if (!price || price <= 0) price = 0.00001;

  // cache final
  cachePriceUsd = Number(price);
  cacheTime = now;

  return cachePriceUsd;
}


module.exports = { getHbrPriceUsd };
