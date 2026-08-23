const { ethers } = require("hardhat");
(async () => {
  const s = await ethers.getContractAt("TitanSecurityAdmin","0x572Fc8027F6Ad901DF785C33F4Ae9012c6b06E6c");
  console.log("isBlocked now:", await s.isBlocked("0xCb64A7c9895A3807F23a23c25e0dB138b3A3e0cd"));
  console.log("paused now:", await s.paused());
})().catch(e=>{console.error(e.message);process.exit(1)});
