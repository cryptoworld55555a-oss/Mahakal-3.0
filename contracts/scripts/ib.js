const { ethers } = require("hardhat");
(async()=>{
  const [me]=await ethers.getSigners();
  const s=await ethers.getContractAt("TitanSecurityAdmin","0xfcB6c96c52d1B037A9b22980aDaA179611043136");
  console.log("isBlocked (fresh):", await s.isBlocked(me.address));
})().catch(e=>console.error(e.message));
