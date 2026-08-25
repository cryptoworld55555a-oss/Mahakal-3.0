// Diagnose + retry remaining named claims on the already-deployed protocol.
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const P = "0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D";
const E = (n) => ethers.parseEther(String(n));
const EXPLORER = "https://testnet.bscscan.com/tx/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [d] = await ethers.getSigners();
  const protocol = await ethers.getContractAt("TitanProtocol", P);
  const cats = [
    { id: 0, name: "ROI", fn: "claimRoi", usd: 5 },
    { id: 1, name: "Level", fn: "claimLevelIncome", usd: 20 },
    { id: 2, name: "Daily", fn: "claimDailyPool", usd: 8 },
    { id: 3, name: "Weekly", fn: "claimWeeklyPool", usd: 6 },
    { id: 4, name: "Monthly", fn: "claimMonthlyPool", usd: 10 },
  ];
  const values = cats.map((c) => [d.address, String(c.id), E(c.usd).toString()]);
  const tree = StandardMerkleTree.of(values, ["address", "uint8", "uint256"]);
  console.log("tree root:", tree.root, "on-chain root:", await protocol.merkleRoot());

  for (const c of cats) {
    const already = await protocol.claimedByCategory(d.address, c.id);
    if (already >= E(c.usd)) { console.log(`${c.fn} already claimed ($${c.usd}) — skip`); continue; }
    const proof = tree.getProof([d.address, String(c.id), E(c.usd).toString()]);
    const dl = Math.floor(Date.now() / 1000) + 1800;
    // static call first to surface the revert reason
    try {
      await protocol[c.fn].staticCall(E(c.usd), 0, dl, proof);
    } catch (e) {
      console.log(`${c.fn} staticCall revert:`, e.shortMessage || e.reason || e.message);
      await sleep(4000);
      continue;
    }
    try {
      const tx = await protocol[c.fn](E(c.usd), 0, dl, proof, { gasLimit: 500000 });
      await tx.wait();
      console.log(`${c.fn}()  ($${c.usd})  ->  ${EXPLORER}${tx.hash}`);
    } catch (e) {
      console.log(`${c.fn} send revert:`, e.shortMessage || e.reason || e.message);
    }
    await sleep(4000);
  }
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
