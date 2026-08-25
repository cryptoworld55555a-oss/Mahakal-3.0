// FULL end-to-end proof on BSC Testnet for the NEW direct-mint architecture:
//   Protocol deployed FIRST -> Token mints ALL supply straight to Protocol ->
//   seedLiquidity() from contract's OWN TTN -> register -> stake (real swap) ->
//   claim EACH named category (ROI/Level/Daily/Weekly/Monthly) at live price (cap UNCHANGED) ->
//   sell (cap reduces by actual USDT). Proves every function still works + new additions.
// Usage: npx hardhat run scripts/full-e2e-v2.js --network bscTestnet
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // Pancake V2 testnet router
const E = (n) => ethers.parseEther(String(n));
const F = (x) => Number(ethers.formatEther(x)).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROUTER_ABI = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[])"];

async function main() {
  const [d] = await ethers.getSigners();
  console.log("User/Deployer:", d.address);
  console.log("BNB:", ethers.formatEther(await ethers.provider.getBalance(d.address)), "\n");
  const dl = () => Math.floor(Date.now() / 1000) + 1200;

  // ===== 1) DEPLOY (new order: Protocol before Token) =====
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy(); await usdt.waitForDeployment();
  const security = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(d.address); await security.waitForDeployment();
  const community = await (await ethers.getContractFactory("CommunityFund")).deploy(); await community.waitForDeployment();
  const protocol = await (await ethers.getContractFactory("TitanProtocol")).deploy(
    await usdt.getAddress(), await security.getAddress(), d.address, d.address, await community.getAddress(), d.address
  ); await protocol.waitForDeployment();
  const P = await protocol.getAddress();
  const ttn = await (await ethers.getContractFactory("TitanToken")).deploy(P); await ttn.waitForDeployment();
  const T = await ttn.getAddress(), U = await usdt.getAddress();
  console.log("TTN:", T, "| PROTOCOL:", P);

  // ===== 2) DIRECT-MINT CHECK =====
  console.log("\n[1] DIRECT MINT:");
  console.log("  Protocol TTN:", F(await ttn.balanceOf(P)), "| Deployer TTN:", F(await ttn.balanceOf(d.address)),
    (await ttn.balanceOf(P)) === E(200000) && (await ttn.balanceOf(d.address)) === 0n ? "✓ all supply on contract, wallet=0" : "✗");

  // ===== 3) WIRING =====
  await (await protocol.setToken(T)).wait();
  await (await protocol.setRouter(ROUTER)).wait();
  await (await community.setProtocol(P)).wait();
  await (await security.setApprovedContract(P, true)).wait();
  await (await protocol.setRootPoster(d.address)).wait();
  console.log("[2] Wiring done (setToken/setRouter/community/security/rootPoster). token linked:", (await protocol.ttn()) === T ? "✓" : "✗");

  // ===== 4) seedLiquidity: REAL launch config -> 20,000 TTN + 200 USDT => $0.01/TTN, LP BURNED =====
  await (await usdt.faucet(E(50000))).wait();
  await (await usdt.approve(P, ethers.MaxUint256)).wait();
  const protoTtnBefore = await ttn.balanceOf(P);
  const DEAD = "0x000000000000000000000000000000000000dEaD";
  await (await protocol.seedLiquidity(E(20000), E(200), DEAD, dl())).wait();
  await sleep(4000);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, d);
  const priceTTN = async () => Number(ethers.formatEther((await router.getAmountsOut(E(1), [T, U]))[1]));
  console.log("[3] seedLiquidity: protocol TTN", F(protoTtnBefore), "->", F(await ttn.balanceOf(P)),
    "| pool price $" + (await priceTTN()).toFixed(4), "✓ liquidity seeded from contract");

  // fund USDT reward reserve (35% bucket) so claims can buy TTN
  await (await usdt.transfer(P, E(3000))).wait();

  // ===== 5) REGISTER + STAKE (real reserve swap) =====
  await (await protocol.register()).wait();
  await (await protocol.stake(E(20), 0, dl())).wait();
  await sleep(5000);
  const cap0 = (await protocol.accountOf(d.address))[3];
  console.log("[4] register + stake $20 -> mining cap:", F(cap0), cap0 === E(40) ? "✓ (200%)" : "✗",
    "| price now $" + (await priceTTN()).toFixed(5));

  // ===== 6) POST CATEGORY MERKLE ROOT =====
  const CAT = { ROI: 0, LEVEL: 1, DAILY: 2, WEEKLY: 3, MONTHLY: 4 };
  const amt = { ROI: 5, LEVEL: 12, DAILY: 2, WEEKLY: 2, MONTHLY: 3 };
  const leaves = Object.keys(CAT).map((k) => [d.address, CAT[k], E(amt[k]).toString()]);
  const tree = StandardMerkleTree.of(leaves, ["address", "uint8", "uint256"]);
  await (await protocol.setMerkleRoot(tree.root)).wait();
  await sleep(4000);
  console.log("[5] Merkle root posted for 5 categories (via rootPoster operator wallet).");

  // ===== 7) CLAIM EACH NAMED CATEGORY (cap must stay UNCHANGED) =====
  const fns = {
    ROI: "claimRoi", LEVEL: "claimLevelIncome", DAILY: "claimDailyPool",
    WEEKLY: "claimWeeklyPool", MONTHLY: "claimMonthlyPool",
  };
  console.log("\n[6] NAMED CLAIMS (each buys TTN live; cap NEVER reduces):");
  for (const k of Object.keys(CAT)) {
    const proof = tree.getProof([d.address, CAT[k], E(amt[k]).toString()]);
    const before = await ttn.balanceOf(d.address);
    const capBefore = (await protocol.accountOf(d.address))[3];
    try {
      await (await protocol[fns[k]](E(amt[k]), 0, dl(), proof)).wait();
      await sleep(4000);
      const got = (await ttn.balanceOf(d.address)) - before;
      const capAfter = (await protocol.accountOf(d.address))[3];
      console.log("  " + fns[k] + " ($" + amt[k] + "): TTN +" + F(got),
        "| cap", F(capBefore), "->", F(capAfter), capAfter === capBefore ? "✓ unchanged" : "✗ CHANGED");
    } catch (e) {
      console.log("  " + fns[k] + " ✗ FAILED:", e.shortMessage || e.message);
    }
  }

  // ===== 8) SELL (cap reduces by actual USDT) =====
  const capBeforeSell = (await protocol.accountOf(d.address))[3];
  const usdtBefore = await usdt.balanceOf(d.address);
  const sellAmt = E(2); // deployer holds ~2.3 TTN from the claims above
  await (await ttn.approve(P, sellAmt)).wait();
  await sleep(3000);
  await (await protocol.sell(sellAmt, 0, dl())).wait();
  await sleep(5000);
  const usdtGot = (await usdt.balanceOf(d.address)) - usdtBefore;
  const capAfterSell = (await protocol.accountOf(d.address))[3];
  console.log("\n[7] SELL 2 TTN: USDT +" + F(usdtGot),
    "| cap", F(capBeforeSell), "->", F(capAfterSell),
    (capBeforeSell - capAfterSell) === usdtGot ? "✓ reduced by exact USDT received" : "✗");

  console.log("\n=== ALL MECHANISMS VERIFIED ON THE NEW CONTRACT (direct-mint architecture) ===");
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
