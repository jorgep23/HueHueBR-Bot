const { ethers } = require("ethers");

// RPC da BSC
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

// ENDEREÇOS
const HBR = "0x56237b2948446e5DE4075e80bedD78eADF35ac67";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// Par HBR/WBNB (seu link do GeckoTerminal)
const PAIR_HBR_WBNB = "0xf69d28c20c4a28b00227f33be5108e2d8b66cf9f";

// ABI mínima
const PAIR_ABI = [
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() view returns (address)",
  "function token1() view returns (address)"
];

// Par BNB/USD (WBNB/BUSD) – PancakeSwap oficial v2
const PAIR_WBNB_BUSD = "0x1b96b92314c44b159149f7e0303511fb2fc4774f";


// ============ FUNÇÃO PRINCIPAL ============

async function getPrice() {
  try {
    // Ler contratos
    const pair = new ethers.Contract(PAIR_HBR_WBNB, PAIR_ABI, provider);
    const busdPair = new ethers.Contract(PAIR_WBNB_BUSD, PAIR_ABI, provider);

    // --- Preço HBR/WBNB ---
    const token0 = await pair.token0();
    const { reserve0, reserve1 } = await pair.getReserves();

    let hbrPriceInBNB;

    if (token0.toLowerCase() === HBR.toLowerCase()) {
      // HBR é token0 → preço = reserve1 / reserve0
      hbrPriceInBNB = Number(reserve1) / Number(reserve0);
    } else {
      // HBR é token1 → preço = reserve0 / reserve1
      hbrPriceInBNB = Number(reserve0) / Number(reserve1);
    }

    // --- Preço WBNB/USD ---
    const bToken0 = await busdPair.token0();
    const busdRes = await busdPair.getReserves();

    let bnbPriceUsd;

    if (bToken0.toLowerCase() === WBNB.toLowerCase()) {
      bnbPriceUsd = Number(busdRes.reserve1) / Number(busdRes.reserve0);
    } else {
      bnbPriceUsd = Number(busdRes.reserve0) / Number(busdRes.reserve1);
    }

    // Preço final
    const priceUsd = hbrPriceInBNB * bnbPriceUsd;
    const priceBrl = priceUsd * 5.5; // conversão aproximada

    return {
      usd: priceUsd,
      brl: priceBrl,
      bnb: hbrPriceInBNB
    };

  } catch (err) {
    console.log("getPrice ERROR:", err.message);
    return {
      usd: 0,
      brl: 0,
      bnb: 0
    };
  }
}

module.exports = { getPrice };
