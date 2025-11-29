const { ethers } = require("ethers");

if (!process.env.RPC_URL || !process.env.BOT_PRIVATE_KEY || !process.env.TOKEN_ADDRESS) {
  throw new Error("❌ Variáveis de ambiente RPC_URL, BOT_PRIVATE_KEY ou TOKEN_ADDRESS não definidas");
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const tokenContract = new ethers.Contract(process.env.TOKEN_ADDRESS, [
  "function transfer(address to, uint256 amount) returns (bool)"
], wallet);

async function sendDrop(to, amount) {
  if (!ethers.isAddress(to)) return { success: false, error: "Endereço inválido" };
  if (!amount || isNaN(amount) || Number(amount) <= 0) return { success: false, error: "Quantidade inválida" };

  try {
    const tx = await tokenContract.transfer(to, ethers.parseUnits(amount.toString(), 18));
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

module.exports = { sendDrop };
