// BSC-Testnet demo of NAMED per-category claim functions (BscScan labels).
// Deploys fresh -> liquidity (1 TTN=$10) -> fund reserve -> register+stake
// -> post Merkle root with 5 category leaves -> call each named claim function.
// Each tx shows a distinct method on BscScan: Claim Roi / Claim Level Income /
// Claim Daily Pool / Claim Weekly Pool / Claim Monthly Pool.
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const E = (n) => ethers.parseEther(String(n));
const ROUTER_ABI = [
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)",
];
const EXPLORER = "https://testnet.bscscan.com/tx/";

async function main() {
  const [d] = await ethers.getSigners();
  console.log("Deployer:", d.address);

  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy(); await usdt.waitForDeployment();
  const ttn = await (await ethers.getContractFactory("TitanToken")).deploy(d.address); await ttn.waitForDeployment();
  const security = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(d.address); await security.waitForDeployment();
  const community = await (await ethers.getContractFactory("CommunityFund")).deploy(); await community.waitForDeployment();
  const protocol = await (await ethers.getContractFactory("TitanProtocol")).deploy(
    await usdt.getAddress(), await ttn.getAddress(), await security.getAddress(),
    d.address, d.address, await community.getAddress(), d.address); await protocol.waitForDeployment();

  const P = await protocol.getAddress();
  await (await protocol.setRouter(ROUTER)).wait();
  await (await ttn.setWhitelisted(P, true)).wait();
  await (await community.setProtocol(P)).wait();
  await (await security.setApprovedContract(P, true)).wait();
  console.log("Deployed + wired. Protocol:", P);

  // Liquidity 1000 TTN : 10000 USDT => 1 TTN = $10
  await (await usdt.faucet(E(30000))).wait();
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, d);
  await (await ttn.approve(ROUTER, E(1000))).wait();
  await (await usdt.approve(ROUTER, E(10000))).wait();
  let dl = Math.floor(Date.now() / 1000) + 1800;
  await (await router.addLiquidity(await ttn.getAddress(), await usdt.getAddress(), E(1000), E(10000), 0, 0, d.address, dl)).wait();
  console.log("Liquidity added (1 TTN = $10).");

  // Fund protocol USDT reward reserve + register + stake $100 (cap $200)
  await (await usdt.transfer(P, E(2000))).wait();
  await (await usdt.approve(P, ethers.MaxUint256)).wait();
  await (await protocol.register()).wait();
  await (await protocol.stake(E(100), 0, dl)).wait();
  console.log("Registered + staked $100 (cap $200).");

  // Backend builds ONE Merkle root with 5 per-category leaves for this user.
  // Leaf = [address, uint8 category, uint256 cumulativeUsd]. category 0..4.
  const cats = [
    { id: 0, name: "ROI",     fn: "claimRoi",         usd: 5 },
    { id: 1, name: "Level",   fn: "claimLevelIncome", usd: 20 },
    { id: 2, name: "Daily",   fn: "claimDailyPool",   usd: 8 },
    { id: 3, name: "Weekly",  fn: "claimWeeklyPool",  usd: 6 },
    { id: 4, name: "Monthly", fn: "claimMonthlyPool", usd: 10 },
  ];
  const values = cats.map((c) => [d.address, String(c.id), E(c.usd).toString()]);
  const tree = StandardMerkleTree.of(values, ["address", "uint8", "uint256"]);
  await (await protocol.setMerkleRoot(tree.root)).wait();
  console.log("Merkle root posted:", tree.root, "epoch", (await protocol.rewardEpoch()).toString());

  console.log("\n=== NAMED CLAIMS (each is a distinct BscScan method) ===");
  const results = [];
  for (const c of cats) {
    const proof = tree.getProof([d.address, String(c.id), E(c.usd).toString()]);
    dl = Math.floor(Date.now() / 1000) + 1800;
    const tx = await protocol[c.fn](E(c.usd), 0, dl, proof);
    await tx.wait();
    console.log(`${c.fn}()  ($${c.usd})  ->  ${EXPLORER}${tx.hash}`);
    results.push({ name: c.name, fn: c.fn, hash: tx.hash });
  }

  console.log("\n=== NEW TESTNET ADDRESSES ===");
  console.log("TOKEN_ADDRESS=", await ttn.getAddress());
  console.log("MAIN_PROTOCOL_ADDRESS=", P);
  console.log("SECURITY_ADMIN_ADDRESS=", await security.getAddress());
  console.log("COMMUNITY_FUND_ADDRESS=", await community.getAddress());
  console.log("USDT_ADDRESS=", await usdt.getAddress());
  console.log("\nProtocol on BscScan:", "https://testnet.bscscan.com/address/" + P);
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
