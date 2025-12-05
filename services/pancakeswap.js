// services/pancakeswap.js
const { ethers } = require('ethers');
const PCS_ROUTER = process.env.PCS_ROUTER || "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const ABI = ["function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"];
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC || "https://bsc-dataseed.binance.org/");

async function getHbrPriceUsd(hbrAddress, busdAddress = process.env.BUSD_ADDRESS) {
  try {
    const router = new ethers.Contract(PCS_ROUTER, ABI, provider);
    const amountIn = ethers.utils.parseUnits("1", 18);
    const path = [hbrAddress, busdAddress];
    const amounts = await router.getAmountsOut(amountIn, path);
    const formatted = Number(ethers.utils.formatUnits(amounts[1], 18));
    return formatted;
  } catch (err) {
    console.warn("getHbrPriceUsd error", err && err.message ? err.message : err);
    return null;
  }
}

module.exports = { getHbrPriceUsd };
