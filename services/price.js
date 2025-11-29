const { ethers } = require("ethers");
const axios = require("axios");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Pool HBR/WBNB (v3)
const poolAddress = ethers.getAddress("0xf69D28c20C4a28b00227f33be5108e2d8b66cf9f"); // retorna checksum
const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

// Pegando preço do HBR em USD
async function getPrice() {
  try {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Preço HBR/WBNB
    const priceHBR_WBNB = (Number(sqrtPriceX96.toString()) / 2 ** 96) ** 2;

    // Pega preço do WBNB em USD via CoinGecko
    const res = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=wbnb&vs_currencies=usd");
    const priceWBNB = res.data.wbnb.usd;

    const priceHBR_USD = priceHBR_WBNB * priceWBNB;

    return priceHBR_USD;
  } catch (err) {
    console.error("getPrice ERROR:", err);
    return 0;
  }
}

module.exports = { getPrice };
