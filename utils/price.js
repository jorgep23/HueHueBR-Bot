import Web3 from "web3";

// ABI mínima para pool V3 (slot0, token0, token1, fee)
export const v3PoolAbi = [
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" },
      { "internalType": "int24", "name": "tick", "type": "int24" },
      { "internalType": "uint16", "name": "observationIndex", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinality", "type": "uint16" },
      { "internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16" },
      { "internalType": "uint8", "name": "feeProtocol", "type": "uint8" },
      { "internalType": "bool", "name": "unlocked", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// ABI mínima do ERC20
export const erc20Abi = [
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  }
];

export async function getV3Price(poolAddress, rpcUrl) {
  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  const pool = new web3.eth.Contract(v3PoolAbi, poolAddress);

  try {
    // tokens do pool
    const token0 = await pool.methods.token0().call();
    const token1 = await pool.methods.token1().call();

    const token0Contract = new web3.eth.Contract(erc20Abi, token0);
    const token1Contract = new web3.eth.Contract(erc20Abi, token1);

    const dec0 = await token0Contract.methods.decimals().call();
    const dec1 = await token1Contract.methods.decimals().call();

    const sym0 = await token0Contract.methods.symbol().call();
    const sym1 = await token1Contract.methods.symbol().call();

    // slot0 → contém sqrtPriceX96
    const slot0 = await pool.methods.slot0().call();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // fórmula V3 para preço:
    // price = (sqrtPriceX96^2 / 2^192) * 10^(dec0 - dec1)
    const price =
      (sqrtPriceX96 ** 2) /
      (2n ** 192n) *
      (10 ** (dec0 - dec1));

    return {
      token0: sym0,
      token1: sym1,
      price: Number(price)
    };

  } catch (error) {
    console.error("Erro no cálculo do preço V3:", error);
    throw new Error("Erro ao calcular preço da pool V3");
  }
}
