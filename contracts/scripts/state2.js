const { ethers } = require("hardhat");
const P="0x32fb34Ea6720866c67DFB7a34Fb03d559B14A46c";
const T="0x804b9997972b870c19778e6796DAc35440899355";
const U="0x6Ef85C5ebd147E262c5E64b28F24A55333B85690";
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol",P);
  const t=await ethers.getContractAt("TitanToken",T);
  const u=await ethers.getContractAt("MockUSDT",U);
  const a=await p.accountOf(me.address);
  console.log("NEW protocol state:");
  console.log("  totalStaked:",ethers.formatEther(a[2]),"| miningCap:",ethers.formatEther(a[3]));
  console.log("  protocol USDT:",ethers.formatEther(await u.balanceOf(P)));
  console.log("  protocol TTN reserve:",ethers.formatEther(await t.balanceOf(P)));
  const rc=await ethers.provider.getTransactionReceipt("0xf0f12b19fd6003ad54a209854b5172280f391df40cd64b61a5717236ee71a903");
  console.log("  claim tx status:", rc && rc.status===1 ? "SUCCESS" : "FAIL");
})().catch(e=>{console.error(e.message);process.exit(1)});
