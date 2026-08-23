// Prints deployer address + BSC Testnet balance (never prints the secret).
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const addr = await deployer.getAddress();
  const bal = await ethers.provider.getBalance(addr);
  console.log("Deployer address:", addr);
  console.log("tBNB balance:", ethers.formatEther(bal));
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
