const hre = require("hardhat");

// Module 1 deploy: token + 4 contract skeletons, then wire them together.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // USDT on BSC Testnet (set to your test USDT / mock). Placeholder here.
  const USDT = process.env.USDT_ADDRESS || "0x0000000000000000000000000000000000000000";
  const BACKEND_SIGNER = process.env.BACKEND_SIGNER || deployer.address;

  const Token = await hre.ethers.getContractFactory("TitanToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();

  const Protocol = await hre.ethers.getContractFactory("MainProtocol");
  const protocol = await Protocol.deploy(USDT);
  await protocol.waitForDeployment();

  const Pool = await hre.ethers.getContractFactory("PoolManager");
  const pool = await Pool.deploy();
  await pool.waitForDeployment();

  const Fund = await hre.ethers.getContractFactory("CommunityFund");
  const fund = await Fund.deploy();
  await fund.waitForDeployment();

  const Reward = await hre.ethers.getContractFactory("RewardEngine");
  const reward = await Reward.deploy(USDT, await token.getAddress(), BACKEND_SIGNER);
  await reward.waitForDeployment();

  await (await protocol.wireModules(
    await pool.getAddress(),
    await fund.getAddress(),
    await reward.getAddress()
  )).wait();
  await (await pool.setProtocol(await protocol.getAddress())).wait();
  await (await fund.setProtocol(await protocol.getAddress())).wait();

  console.log("TitanToken:   ", await token.getAddress());
  console.log("MainProtocol: ", await protocol.getAddress());
  console.log("PoolManager:  ", await pool.getAddress());
  console.log("CommunityFund:", await fund.getAddress());
  console.log("RewardEngine: ", await reward.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
