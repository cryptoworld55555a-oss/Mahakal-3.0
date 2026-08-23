const { ethers } = require("hardhat");
async function main() {
  const [d] = await ethers.getSigners();
  console.log("deployer", d.address);
  console.log("BNB", ethers.formatEther(await ethers.provider.getBalance(d.address)));
}
main().catch((e) => { console.error(e); process.exit(1); });
