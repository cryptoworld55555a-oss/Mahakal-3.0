const { ethers } = require("hardhat");
const P="0xC3003529750189a98158A6B73fAc1b33Cdad068c";
const S="0xfcB6c96c52d1B037A9b22980aDaA179611043136";
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol",P);
  const s=await ethers.getContractAt("TitanSecurityAdmin",S);
  const dl=Math.floor(Date.now()/1000)+600;

  // 1) block self
  await (await s.blockUser(me.address)).wait();
  console.log("blockUser done. isBlocked:", await s.isBlocked(me.address));

  // 2) try sell while blocked -> must revert "user blocked"
  try{
    await p.sellMined.staticCall(ethers.parseEther("1"), 0, Date.now(), dl, "0x");
    console.log("FAIL: sell allowed while blocked");
  }catch(e){ console.log("SELL BLOCKED on-chain ->", e.shortMessage||e.reason||"reverted"); }

  // 3) also verify claim blocked
  try{
    await p.claimReward.staticCall(ethers.parseEther("1"), false, 0, Date.now(), dl, "0x");
    console.log("FAIL: claim allowed while blocked");
  }catch(e){ console.log("CLAIM BLOCKED on-chain ->", e.shortMessage||e.reason||"reverted"); }

  // 4) unblock
  await (await s.unblockUser(me.address)).wait();
  console.log("unblockUser done. isBlocked:", await s.isBlocked(me.address));
})().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1)});
