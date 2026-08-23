const { ethers } = require("hardhat");
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol","0xf8eaf47A1Ee1a2f60f817743fCD72D33665ed537");
  console.log("cap after permissionless sell:",ethers.formatEther((await p.accountOf(me.address))[3]),"(was 200, reduced by USD received on sell)");
})().catch(e=>console.error(e.message));
