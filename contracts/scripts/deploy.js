// TITAN full-system deploy + wiring script (BSC Testnet / Mainnet)
// Usage: npx hardhat run scripts/deploy.js --network bscTestnet
const { ethers } = require("hardhat");

// PancakeSwap V2 router: testnet default; override via env PANCAKE_ROUTER for mainnet (0x10ED43C718714eb63d5aA57B78B54704E256024E)
const ROUTER = process.env.PANCAKE_ROUTER || "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap testnet router
const USE_MOCK_USDT = (process.env.USE_MOCK_USDT || "true") === "true"; // false on mainnet -> set REAL_USDT
const REAL_USDT = process.env.REAL_USDT || ""; // mainnet BSC-USD: 0x55d398326f99059fF775485246999027B3197955

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.ADMIN_ADDRESS || deployer.address;   // ideally a multi-sig
  const signer = process.env.SIGNER_ADDRESS || deployer.address; // backend authorization signer
  const devWallet = process.env.DEV_WALLET || deployer.address;
  const dailyWallet = process.env.DAILY_POOL_WALLET || deployer.address;
  const weeklyWallet = process.env.WEEKLY_POOL_WALLET || deployer.address;
  const monthlyWallet = process.env.MONTHLY_POOL_WALLET || deployer.address;
  const liquidityWallet = process.env.LIQUIDITY_WALLET || deployer.address;

  console.log("Deployer:", deployer.address);

  // 1) USDT
  let usdt;
  if (USE_MOCK_USDT) {
    usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    await usdt.waitForDeployment();
    console.log("MockUSDT:", await usdt.getAddress());
  } else {
    if (!REAL_USDT) throw new Error("Set REAL_USDT for mainnet");
    usdt = await ethers.getContractAt("IERC20", REAL_USDT);
    console.log("USDT (real):", REAL_USDT);
  }

  // 2) TITAN token (full supply to deployer/treasury)
  const ttn = await (await ethers.getContractFactory("TitanToken")).deploy(deployer.address);
  await ttn.waitForDeployment();
  console.log("TitanToken:", await ttn.getAddress());

  // 3) Security & Admin
  const security = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(admin);
  await security.waitForDeployment();
  console.log("TitanSecurityAdmin:", await security.getAddress());

  // 4) Community Fund
  const community = await (await ethers.getContractFactory("CommunityFund")).deploy();
  await community.waitForDeployment();
  console.log("CommunityFund:", await community.getAddress());

  // 5) Protocol
  const protocol = await (await ethers.getContractFactory("TitanProtocol")).deploy(
    await usdt.getAddress(),
    await ttn.getAddress(),
    await security.getAddress(),
    signer,
    devWallet,
    await community.getAddress(),
    deployer.address
  );
  await protocol.waitForDeployment();
  console.log("TitanProtocol:", await protocol.getAddress());

  // 6) Wiring
  await (await protocol.setRouter(ROUTER)).wait();
  await (await ttn.setWhitelisted(await protocol.getAddress(), true)).wait();
  await (await community.setProtocol(await protocol.getAddress())).wait();
  await (await security.setApprovedContract(await protocol.getAddress(), true)).wait();
  await (await security.setSystemWallet(await security.DEV_WALLET(), devWallet)).wait();
  await (await security.setSystemWallet(await security.DAILY_POOL_WALLET(), dailyWallet)).wait();
  await (await security.setSystemWallet(await security.WEEKLY_POOL_WALLET(), weeklyWallet)).wait();
  await (await security.setSystemWallet(await security.MONTHLY_POOL_WALLET(), monthlyWallet)).wait();
  await (await security.setSystemWallet(await security.LIQUIDITY_WALLET(), liquidityWallet)).wait();
  console.log("Wiring done.");

  console.log("\n=== SET THESE IN frontend/.env AND backend/.env ===");
  console.log("TOKEN_ADDRESS=", await ttn.getAddress());
  console.log("MAIN_PROTOCOL_ADDRESS=", await protocol.getAddress());
  console.log("SECURITY_ADMIN_ADDRESS=", await security.getAddress());
  console.log("COMMUNITY_FUND_ADDRESS=", await community.getAddress());
  console.log("USDT_ADDRESS=", await usdt.getAddress());
  console.log("PANCAKE_ROUTER=", ROUTER);
}

main().catch((e) => { console.error(e); process.exit(1); });
