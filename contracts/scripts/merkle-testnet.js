// Full BSC-Testnet proof for Merkle reward claim (live PancakeSwap price).
// Deploys fresh -> adds liquidity (1 TTN=$10) -> funds reserve -> register+stake
// -> post Merkle root -> claimMerkle -> verify TTN received at live price + cap reduced.
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const E = (n) => ethers.parseEther(String(n));
const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)",
];

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
  console.log("Deployed+wired. Protocol:", P);

  // Liquidity 1000 TTN : 10000 USDT  => 1 TTN = $10
  await (await usdt.faucet(E(30000))).wait();
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, d);
  await (await ttn.approve(ROUTER, E(1000))).wait();
  await (await usdt.approve(ROUTER, E(10000))).wait();
  const dl = Math.floor(Date.now() / 1000) + 1200;
  await (await router.addLiquidity(await ttn.getAddress(), await usdt.getAddress(), E(1000), E(10000), 0, 0, d.address, dl)).wait();
  console.log("Liquidity added (1 TTN = $10).");

  // Fund protocol USDT reward reserve
  await (await usdt.transfer(P, E(2000))).wait();

  // Register + stake $100 (cap $200)
  await (await usdt.approve(P, ethers.MaxUint256)).wait();
  await (await protocol.register()).wait();
  await (await protocol.stake(E(100), 0, dl)).wait();
  const capAfterStake = (await protocol.accountOf(d.address))[3];
  console.log("Cap after stake:", ethers.formatEther(capAfterStake));

  // Backend builds Merkle root (cumulative $20, cap-reducing). Backend signs NOTHING.
  const tree = StandardMerkleTree.of([[d.address, E(20).toString(), true]], ["address", "uint256", "bool"]);
  await (await protocol.setMerkleRoot(tree.root)).wait();
  console.log("Merkle root posted:", tree.root, "epoch", (await protocol.rewardEpoch()).toString());

  const proof = tree.getProof([d.address, E(20).toString(), true]);
  const ttnBefore = await ttn.balanceOf(d.address);
  const dl2 = Math.floor(Date.now() / 1000) + 1200;
  const tx = await protocol.claimMerkle(E(20), true, 0, dl2, proof);
  console.log("claimMerkle tx:", tx.hash);
  await tx.wait();

  const ttnAfter = await ttn.balanceOf(d.address);
  const capAfterClaim = (await protocol.accountOf(d.address))[3];
  console.log("TTN received (live price for $20):", ethers.formatEther(ttnAfter - ttnBefore));
  console.log("Cap after claim (200 - 20 = 180):", ethers.formatEther(capAfterClaim));

  console.log("\n=== NEW TESTNET ADDRESSES ===");
  console.log("TOKEN_ADDRESS=", await ttn.getAddress());
  console.log("MAIN_PROTOCOL_ADDRESS=", P);
  console.log("SECURITY_ADMIN_ADDRESS=", await security.getAddress());
  console.log("COMMUNITY_FUND_ADDRESS=", await community.getAddress());
  console.log("USDT_ADDRESS=", await usdt.getAddress());
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
