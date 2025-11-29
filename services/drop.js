const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

async function sendDrop(to, amount) {
  try {
    const tx = await tokenContract.transfer(to, ethers.parseUnits(amount.toString(), 18));
    await tx.wait();
    return { success: true, txHash: tx.hash };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendDrop };
