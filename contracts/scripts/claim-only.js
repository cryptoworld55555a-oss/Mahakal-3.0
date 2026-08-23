const { ethers } = require("hardhat");
const P="0x32fb34Ea6720866c67DFB7a34Fb03d559B14A46c";
const T="0x804b9997972b870c19778e6796DAc35440899355";
(async()=>{
  const [me]=await ethers.getSigners();
  const chainId=(await ethers.provider.getNetwork()).chainId;
  const p=await ethers.getContractAt("TitanProtocol",P);
  const t=await ethers.getContractAt("TitanToken",T);
  const dl=Math.floor(Date.now()/1000)+1800;
  const nonce=Date.now();
  const d=ethers.solidityPackedKeccak256(
    ["string","address","uint256","bool","uint256","uint256","address","uint256"],
    ["CLAIM",me.address,ethers.parseEther("10"),true,nonce,dl,P,chainId]);
  const sig=await me.signMessage(ethers.getBytes(d));
  const before=await t.balanceOf(me.address);
  const capBefore=(await p.accountOf(me.address))[3];
  const tx=await p.claimReward(ethers.parseEther("10"),true,0,nonce,dl,sig);
  console.log("claim tx:",tx.hash);
  await tx.wait();
  const after=await t.balanceOf(me.address);
  console.log("TTN received on claim:",ethers.formatEther(after-before),"(~1 TTN at $10)");
  console.log("cap:",ethers.formatEther(capBefore),"->",ethers.formatEther((await p.accountOf(me.address))[3]));
  console.log("CLAIM-AS-TTN VERIFIED ON TESTNET");
})().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1)});
