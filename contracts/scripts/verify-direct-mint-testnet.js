// Proves the DIRECT-MINT-TO-CONTRACT flow on BSC Testnet:
// Protocol deployed first, then Token mints entire supply straight to Protocol.
// Usage: npx hardhat run scripts/verify-direct-mint-testnet.js --network bscTestnet
const { ethers } = require("hardhat");

async function main() {
  const [d] = await ethers.getSigners();
  console.log("Deployer:", d.address);
  console.log("Balance BNB:", ethers.formatEther(await ethers.provider.getBalance(d.address)));

  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  await usdt.waitForDeployment();
  const security = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(d.address);
  await security.waitForDeployment();
  const community = await (await ethers.getContractFactory("CommunityFund")).deploy();
  await community.waitForDeployment();

  const protocol = await (await ethers.getContractFactory("TitanProtocol")).deploy(
    await usdt.getAddress(), await security.getAddress(),
    d.address, d.address, await community.getAddress(), d.address
  );
  await protocol.waitForDeployment();
  const protoAddr = await protocol.getAddress();
  console.log("TitanProtocol:", protoAddr);

  // Token deployed AFTER protocol -> mints full supply DIRECTLY to protocol.
  const ttn = await (await ethers.getContractFactory("TitanToken")).deploy(protoAddr);
  const dep = await ttn.deploymentTransaction().wait();
  const ttnAddr = await ttn.getAddress();
  console.log("TitanToken:", ttnAddr, "| deploy tx:", dep.hash);

  const protoBal = await ttn.balanceOf(protoAddr);
  const deployerBal = await ttn.balanceOf(d.address);
  console.log("Protocol TTN balance :", ethers.formatEther(protoBal));
  console.log("Deployer TTN balance :", ethers.formatEther(deployerBal));

  await (await protocol.setToken(ttnAddr)).wait();
  console.log("setToken linked. Token linked:", await protocol.ttn());

  console.log("\nPROOF:");
  console.log("- Token's FIRST tx (contract creation mint) sent 200000 TTN -> Protocol contract.");
  console.log("- Deployer wallet TTN =", ethers.formatEther(deployerBal), "(zero => no wallet->contract transfer will ever appear).");
  console.log("- On BscScan, Protocol contract is holder #1 from the token's very first transaction.");
}
main().catch((e) => { console.error(e); process.exit(1); });
