const { ethers } = require("hardhat");
const P="0xC3003529750189a98158A6B73fAc1b33Cdad068c";
const T="0x93a457066c8C00CB34c56eb6802BfD4282728818";
const U="0x7f54d89589bE32eE2Eb125C12624b2A8AD338789";
const ROUTER="0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const E=(n)=>ethers.parseEther(String(n));
const RABI=["function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)"];
(async()=>{
  const [me]=await ethers.getSigners();
  const chainId=(await ethers.provider.getNetwork()).chainId;
  const p=await ethers.getContractAt("TitanProtocol",P);
  const t=await ethers.getContractAt("TitanToken",T);
  const u=await ethers.getContractAt("MockUSDT",U);
  const r=new ethers.Contract(ROUTER,RABI,me);
  const dl=Math.floor(Date.now()/1000)+1800;

  await (await u.faucet(E(20000))).wait();
  await (await t.approve(ROUTER,E(1000))).wait();
  await (await u.approve(ROUTER,E(10000))).wait();
  await (await r.addLiquidity(T,U,E(1000),E(10000),0,0,me.address,dl)).wait();
  console.log("liquidity added (restricted token OK for LP)");

  try{await (await p.register()).wait();}catch(e){}
  await (await u.approve(P,ethers.MaxUint256)).wait();
  await (await p.stake(E(100),0,dl)).wait();
  console.log("staked $100, cap:",ethers.formatEther((await p.accountOf(me.address))[3]));

  const nonce=Date.now();
  const d=ethers.solidityPackedKeccak256(
    ["string","address","uint256","bool","uint256","uint256","address","uint256"],
    ["CLAIM",me.address,E(10),true,nonce,dl,P,chainId]);
  const sig=await me.signMessage(ethers.getBytes(d));
  const tx=await p.claimReward(E(10),true,0,nonce,dl,sig);
  await tx.wait();
  console.log("claim tx:",tx.hash,"status: SUCCESS");
})().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1)});
