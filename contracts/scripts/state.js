const { ethers } = require("hardhat");
const P="0xbC55Cd51761c4369754DAc706881C983C7FA35eC";
const T="0xa38427DA27828A72699Df34c694038921Aa19f9B";
const U="0x0aAA413E7C9f7545Db77FfD3a96F7a640AB55D0F";
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol",P);
  const t=await ethers.getContractAt("TitanToken",T);
  const u=await ethers.getContractAt("MockUSDT",U);
  const a=await p.accountOf(me.address);
  console.log("registered:",a[0],"| ownerTier:",a[1],"| totalStaked:",ethers.formatEther(a[2]),"| miningCap:",ethers.formatEther(a[3]));
  console.log("protocol TTN reserve:",ethers.formatEther(await t.balanceOf(P)));
  console.log("protocol USDT reserve:",ethers.formatEther(await u.balanceOf(P)));
})().catch(e=>{console.error(e.message);process.exit(1)});
