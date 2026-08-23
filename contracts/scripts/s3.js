const { ethers } = require("hardhat");
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol","0xC3003529750189a98158A6B73fAc1b33Cdad068c");
  const a=await p.accountOf(me.address);
  console.log("cap after claim:",ethers.formatEther(a[3]),"(expect 190)");
})().catch(e=>console.error(e.message));
