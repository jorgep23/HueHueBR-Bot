const { ethers } = require("ethers");

// Configurações
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Endereço da pool HBR/WBNB (você deve confirmar no GeckoTerminal)
const POOL_ADDRESS_RAW = "0xf69d28c20c4a28b00227f33be5108e2d8b66cf9f";
const POOL_ADDRESS = ethers.getAddress(POOL_ADDRESS_RAW); // Corrige checksum

// ABI mínima para ler preço em PancakeSwap V3
const POOL_ABI = [
"function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

// Converte sqrtPriceX96 para preço token0/token1
function sqrtPriceX96ToPrice(sqrtPriceX96) {
const num = BigInt(sqrtPriceX96) ** 2n;
const denom = 2n ** 192n;
return Number(num) / Number(denom);
}

async function getPrice() {
try {
const slot0 = await poolContract.slot0();
const price = sqrtPriceX96ToPrice(slot0.sqrtPriceX96);
return price; // preço HBR/WBNB
} catch (err) {
console.error("getPrice ERROR:", err);
return 0;
}
}

module.exports = { getPrice };
