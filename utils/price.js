const { web3 } = require("./web3");

// Função para calcular preço de pool V3 a partir do slot0
async function getV3Price(poolAddress) {
  // ABI mínima do Pool V3 para ler slot0 e tokens
  const poolABI = [
    { "inputs": [], "name": "slot0", "outputs":[
      {"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},
      {"internalType":"int24","name":"tick","type":"int24"},
      {"internalType":"uint16","name":"observationIndex","type":"uint16"},
      {"internalType":"uint16","name":"observationCardinality","type":"uint16"},
      {"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},
      {"internalType":"uint8","name":"feeProtocol","type":"uint8"},
      {"internalType":"bool","name":"unlocked","type":"bool"}
    ], "stateMutability":"view","type":"function"},
    { "inputs": [], "name":"token0", "outputs":[{"internalType":"address","name":"","type":"address"}], "stateMutability":"view","type":"function"},
    { "inputs": [], "name":"token1", "outputs":[{"internalType":"address","name":"","type":"address"}], "stateMutability":"view","type":"function"}
  ];

  const pool = new web3.eth.Contract(poolABI, poolAddress);

  const [slot0, token0, token1] = await Promise.all([
    pool.methods.slot0().call(),
    pool.methods.token0().call(),
    pool.methods.token1().call()
  ]);

  // sqrtPriceX96 => preço token1/token0
  const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
  const price = Number(sqrtPriceX96 ** 2n) / (2 ** 192);

  return { price, token0, token1 };
}

module.exports = { getV3Price };
