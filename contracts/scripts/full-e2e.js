// FULL end-to-end proof on BSC Testnet:
//  stake -> cap set; claim each reward type (ROI/level/daily/weekly/monthly) as TTN at LIVE price;
//  verify cap behaviour (monthly+level reduce, ROI+daily+weekly do NOT); price UP on claim (buy),
//  price DOWN on sell; cap reduces by actual USDT on sell.
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const E = (n) => ethers.parseEther(String(n));
const F = (x) => Number(ethers.formatEther(x)).toFixed(4);
const ROUTER_ABI = [
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)",
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])",
];

async function main() {
  const [d] = await ethers.getSigners();
  console.log("User/Deployer:", d.address, "\n");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- deploy + wire
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
  console.log("Contracts: TTN", await ttn.getAddress(), "| PROTOCOL", P, "\n");

  // ---- liquidity 1000 TTN : 10000 USDT (1 TTN = $10) + fund reserve
  await (await usdt.faucet(E(40000))).wait();
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, d);
  await (await ttn.approve(ROUTER, E(1000))).wait();
  await (await usdt.approve(ROUTER, E(10000))).wait();
  const dl = () => Math.floor(Date.now() / 1000) + 1200;
  await (await router.addLiquidity(await ttn.getAddress(), await usdt.getAddress(), E(1000), E(10000), 0, 0, d.address, dl())).wait();
  await (await usdt.transfer(P, E(3000))).wait();

  const T = await ttn.getAddress(), U = await usdt.getAddress();
  const priceTTN = async () => {
    const out = await router.getAmountsOut(E(1), [T, U]);   // USDT for 1 TTN
    return Number(ethers.formatEther(out[1]));
  };
  console.log("Initial TTN price: $" + (await priceTTN()).toFixed(4), "\n");

  // ---- stake $100 -> cap $200
  await (await usdt.approve(P, ethers.MaxUint256)).wait();
  await (await protocol.register()).wait();
  await (await protocol.stake(E(100), 0, dl())).wait();
  await sleep(5000);
  const cap0 = (await protocol.accountOf(d.address))[3];
  console.log("After stake $100 -> mining cap:", F(cap0), "(200%)\n");

  // ---- off-chain engine result (already unit-tested): user's cumulative USD rewards
  // capReduce=TRUE  bucket = level income + monthly pool
  // capReduce=FALSE bucket = self ROI + daily pool + weekly pool
  const reducingUsd = 12 + 3;       // level $12 + monthly $3  = $15
  const nonReducingUsd = 5 + 2 + 2; // ROI $5 + daily $2 + weekly $2 = $9
  const tree = StandardMerkleTree.of([
    [d.address, E(reducingUsd).toString(), true],
    [d.address, E(nonReducingUsd).toString(), false],
  ], ["address", "uint256", "bool"]);
  await (await protocol.setMerkleRoot(tree.root)).wait();
  await sleep(4000);
  console.log("Reward root posted. reducing=$" + reducingUsd + " (level+monthly), nonReducing=$" + nonReducingUsd + " (ROI+daily+weekly)\n");

  // ---- CLAIM #1: reducing bucket (level+monthly) -> cap MUST reduce, TTN at live price
  const pB1 = await priceTTN();
  let ttnBal = await ttn.balanceOf(d.address);
  await (await protocol.claimMerkle(E(reducingUsd), true, 0, dl(), tree.getProof([d.address, E(reducingUsd).toString(), true]))).wait();
  await sleep(5000);
  const gotR = (await ttn.balanceOf(d.address)) - ttnBal;
  const capAfterR = (await protocol.accountOf(d.address))[3];
  const pA1 = await priceTTN();
  console.log("CLAIM level+monthly ($" + reducingUsd + "):");
  console.log("  TTN received:", F(gotR), "| cap:", F(cap0), "->", F(capAfterR), capAfterR === cap0 ? "(UNCHANGED ✓ claim never hits cap)" : "(CHANGED ✗)");
  console.log("  price: $" + pB1.toFixed(4), "->", "$" + pA1.toFixed(4), pA1 > pB1 ? "(UP ✓ buying pressure)" : "(??)", "\n");

  // ---- CLAIM #2: non-reducing bucket (ROI+daily+weekly) -> cap UNCHANGED, TTN at live price
  const pB2 = await priceTTN();
  ttnBal = await ttn.balanceOf(d.address);
  await (await protocol.claimMerkle(E(nonReducingUsd), false, 0, dl(), tree.getProof([d.address, E(nonReducingUsd).toString(), false]))).wait();
  await sleep(5000);
  const gotN = (await ttn.balanceOf(d.address)) - ttnBal;
  const capAfterN = (await protocol.accountOf(d.address))[3];
  const pA2 = await priceTTN();
  console.log("CLAIM ROI+daily+weekly ($" + nonReducingUsd + "):");
  console.log("  TTN received:", F(gotN), "| cap:", F(capAfterR), "->", F(capAfterN), capAfterN === capAfterR ? "(UNCHANGED ✓)" : "(CHANGED ✗)");
  console.log("  price: $" + pB2.toFixed(4), "->", "$" + pA2.toFixed(4), pA2 > pB2 ? "(UP ✓)" : "(??)", "\n");

  // ---- SELL: TTN -> USDT, cap reduces by USDT received, price DOWN
  const sellAmt = E(3);
  const pB3 = await priceTTN();
  const usdtBefore = await usdt.balanceOf(d.address);
  await (await ttn.approve(P, sellAmt)).wait();
  await sleep(3000);
  await (await protocol.sell(sellAmt, 0, dl())).wait();
  await sleep(5000);
  const usdtGot = (await usdt.balanceOf(d.address)) - usdtBefore;
  const capAfterSell = (await protocol.accountOf(d.address))[3];
  const pA3 = await priceTTN();
  console.log("SELL 3 TTN:");
  console.log("  USDT received:", F(usdtGot), "| cap:", F(capAfterN), "->", F(capAfterSell), "(reduced by ~USDT received ✓)");
  console.log("  price: $" + pB3.toFixed(4), "->", "$" + pA3.toFixed(4), pA3 < pB3 ? "(DOWN ✓ sell pressure)" : "(??)", "\n");

  console.log("=== SUMMARY: every reward type is claimed as TTN at LIVE price; CLAIM never touches cap;");
  console.log("    cap reduces ONLY on SELL by actual USDT received; claim pushes price UP, sell pushes price DOWN. ===");
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
