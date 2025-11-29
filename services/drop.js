const { ethers } = require("ethers");

// Verifica se todas as variáveis de ambiente estão definidas
if (!process.env.RPC_URL) throw new Error("❌ RPC_URL não definido no .env");
if (!process.env.BOT_PRIVATE_KEY) throw new Error("❌ BOT_PRIVATE_KEY não definido no .env");
if (!process.env.TOKEN_ADDRESS) throw new Error("❌ TOKEN_ADDRESS não definido no .env");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

/**
 * Envia HBR para um usuário (drop)
 * @param {string} to - endereço do usuário
 * @param {number|string} amount - quantidade de tokens
 */
async function sendDrop(to, amount) {
  if (!to || !ethers.isAddress(to)) {
    return { success: false, error: "Endereço inválido" };
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return { success: false, error: "Quantidade inválida" };
  }

  try {
    const tx = await tokenContract.transfer(
      to,
      ethers.parseUnits(amount.toString(), 18)
    );
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}

module.exports = { sendDrop };
