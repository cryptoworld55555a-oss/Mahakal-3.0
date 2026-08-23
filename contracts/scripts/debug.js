const { ethers } = require("hardhat");
const P="0x32fb34Ea6720866c67DFB7a34Fb03d559B14A46c";
const T="0x804b9997972b870c19778e6796DAc35440899355";
const U="0x6Ef85C5ebd147E262c5E64b28F24A55333B85690";
(async()=>{
  const [me]=await ethers.getSigners();
  const chainId=(await ethers.provider.getNetwork()).chainId;
  const p=await ethers.getContractAt("TitanProtocol",P);
  const u=await ethers.getContractAt("MockUSDT",U);
  const t=await ethers.getContractAt("TitanToken",T);
  console.log("signer set in contract:", await p.signer());
  console.log("my address:", me.address);
  console.log("protocol USDT bal:", ethers.formatEther(await u.balanceOf(P)));
  console.log("protocol TTN bal:", ethers.formatEther(await t.balanceOf(P)));
  console.log("cap:", ethers.formatEther((await p.accountOf(me.address))[3]));
  const dl=Math.floor(Date.now()/1000)+1200;
  const nonce=Date.now();
  const d=ethers.solidityPackedKeccak256(
    ["string","address","uint256","bool","uint256","uint256","address","uint256"],
    ["CLAIM",me.address,ethers.parseEther("10"),true,nonce,dl,P,chainId]);
  const sig=await me.signMessage(ethers.getBytes(d));
  try{
    await p.claimReward.staticCall(ethers.parseEther("10"),true,0,nonce,dl,sig);
    console.log("staticCall OK (would succeed)");
  }catch(e){ console.log("REVERT:", e.shortMessage||e.reason||e.message); }
})().catch(e=>{console.error(e.message);process.exit(1)});
