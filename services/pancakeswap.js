const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

const PAIR_ADDRESS = "0xccc3e095bebbef74d140e3a9330f980873263d17";
const WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

const pairAbi = [
  "function getReserves() external view returns (uint112,uint112,uint32)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

async function getHbrPriceUsd(hbrAddress) {
  try {
    const pair = new ethers.Contract(PAIR_ADDRESS, pairAbi, provider);

    const token0 = await pair.token0();
    const token1 = await pair.token1();

    const [r0, r1] = await pair.getReserves();

    let reserveHBR, reserveWBNB;

    if (token0.toLowerCase() === hbrAddress.toLowerCase()) {
      reserveHBR = Number(r0);
      reserveWBNB = Number(r1);
    } else {
      reserveHBR = Number(r1);
      reserveWBNB = Number(r0);
    }

    // preço HBR em BNB
    const priceInBNB = reserveWBNB / reserveHBR;

    // buscar preço do BNB em USD (coingecko free)
    const bnbData = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT")
      .then(r => r.json())
      .catch(() => ({ price: 600 }));

    const bnbUsd = Number(bnbData.price || 600);

    const priceUsd = priceInBNB * bnbUsd;

    return priceUsd;
  } catch (err) {
    console.error("❌ Erro ao calcular preço HBR:", err);
    return 0.00001;
  }
}

module.exports = { getHbrPriceUsd };
