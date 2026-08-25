// Prove admin "Post Root" path + sell() on the verified testnet contract.
const { ethers } = require("hardhat");
const P = "0xc78f03C989Ae4820cCeE94E4A97D66b9605F426D";
const TTN = "0xC7ed8B984A0b445EcC1f8531CAAb1eB41E5326dB";
const BACKEND_ROOT = "0x0d3615058dced96137aa096c50617f86371ae54e93bbdd5e2a30e2a59ef6ef5a";
const EXPLORER = "https://testnet.bscscan.com/tx/";

async function main() {
  const [d] = await ethers.getSigners();
  const p = await ethers.getContractAt("TitanProtocol", P);
  const ttn = await ethers.getContractAt("TitanToken", TTN);

  // 1) Post the BACKEND-generated Merkle root on-chain (what Admin "Post Root" does).
  const tx1 = await p.setMerkleRoot(BACKEND_ROOT);
  await tx1.wait();
  console.log("setMerkleRoot ->", EXPLORER + tx1.hash);
  console.log("on-chain root:", await p.merkleRoot(), "| epoch:", (await p.rewardEpoch()).toString());

  // 2) Prove sell(): deployer has TTN from earlier claims. Sell 1 TTN -> USDT, cap reduces.
  const bal = await ttn.balanceOf(d.address);
  console.log("deployer TTN balance:", ethers.formatEther(bal));
  const capBefore = (await p.accountOf(d.address))[3];
  const sellAmt = ethers.parseEther("1");
  if (bal >= sellAmt) {
    await (await ttn.approve(P, sellAmt)).wait();
    const dl = Math.floor(Date.now() / 1000) + 1800;
    const tx2 = await p.sell(sellAmt, 0, dl, { gasLimit: 500000 });
    await tx2.wait();
    console.log("sell(1 TTN) ->", EXPLORER + tx2.hash);
    const capAfter = (await p.accountOf(d.address))[3];
    console.log("cap before:", ethers.formatEther(capBefore), "-> after sell:", ethers.formatEther(capAfter),
                "(reduced by ~$10 = 1 TTN @ live price)");
  } else {
    console.log("not enough TTN to demo sell");
  }
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
