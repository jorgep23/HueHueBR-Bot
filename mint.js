const { nftContract, wallet } = require("./web3");
const { ethers } = require("ethers");

// Mint via bot (o bot paga a transação, ou apenas cria link para o usuário assinar)
async function mintNFT(quantity = 1) {
  try {
    // Preço do NFT
    const price = await nftContract.mintPrice();
    const totalPrice = price.mul(quantity);

    // Executa mint
    const tx = await nftContract.mint(quantity, { value: totalPrice });
    await tx.wait();

    return { success: true, txHash: tx.hash, quantity };
  } catch (err) {
    console.error("Erro ao fazer mint:", err);
    return { success: false, error: err.message || err };
  }
}

module.exports = { mintNFT };
