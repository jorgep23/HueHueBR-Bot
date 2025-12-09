const { ethers } = require("ethers");

// RPC (BSC)
const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

// Pool para HBR/WBNB
const PAIR_ADDRESS = "0xccc3e095bebbef74d140e3a9330f980873263d17";

// WBNB oficial BSC
const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

const pairAbi = [
  "function getReserves() external view returns (uint112,uint112,uint32)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

async function getHbrPriceUsd(hbrAddress) {
  try {
    const pair = new ethers.Contract(PAIR_ADDRESS, pairAbi, provider);

    // --- 1. Tokens da pool
    const token0 = (await pair.token0()).toLowerCase();
    const token1 = (await pair.token1()).toLowerCase();
    const hbr = hbrAddress.toLowerCase();

    if (token0 !== hbr && token1 !== hbr) {
      console.error("❌ ERRO: HBR não está nesse par! (endereço errado?)");
      return 0.00001;
    }

    // --- 2. Reserves
    const [r0, r1] = await pair.getReserves();

    // ethers BigInts -> Number (com segurança)
    let reserveHBR, reserveWBNB;

    if (token0 === hbr) {
      reserveHBR = Number(r0);
      reserveWBNB = Number(r1);
    } else {
      reserveHBR = Number(r1);
      reserveWBNB = Number(r0);
    }

    if (reserveHBR === 0 || reserveWBNB === 0) {
      console.error("⚠️ LIQUIDEZ ZERO NA POOL");
      return 0.00001;
    }

    // --- 3. Preço HBR em BNB
    const priceInBNB = reserveWBNB / reserveHBR;

    // --- 4. Busca preço BNB em USD (API Binance)
    let bnbUsd = 600;

    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
      const json = await res.json();
      if (json && json.price) bnbUsd = Number(json.price);
    } catch (e) {
      console.log("⚠️ Falha Binance API, usando fallback", e.message);
    }

    // --- 5. Cálculo final
    const priceUsd = priceInBNB * bnbUsd;

    // segurança extrema
    if (!isFinite(priceUsd) || priceUsd <= 0) {
      return 0.00001;
    }

    return priceUsd;

  } catch (err) {
    console.error("❌ getHbrPriceUsd ERRO:", err);
    return 0.00001;
  }
}

module.exports = { getHbrPriceUsd };
