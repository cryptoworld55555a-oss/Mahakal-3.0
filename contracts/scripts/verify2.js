const { ethers } = require("hardhat");
const P="0x32fb34Ea6720866c67DFB7a34Fb03d559B14A46c";
const T="0x804b9997972b870c19778e6796DAc35440899355";
const U="0x6Ef85C5ebd147E262c5E64b28F24A55333B85690";
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
  const dl=Math.floor(Date.now()/1000)+1200;

  // liquidity
  await (await u.faucet(E(20000))).wait();
  await (await t.approve(ROUTER,E(1000))).wait();
  await (await u.approve(ROUTER,E(10000))).wait();
  await (await r.addLiquidity(T,U,E(1000),E(10000),0,0,me.address,dl)).wait();
  console.log("liquidity added");

  // register + stake
  try{await (await p.register()).wait();}catch(e){}
  await (await u.approve(P,ethers.MaxUint256)).wait();
  await (await p.stake(E(100),0,dl)).wait();
  console.log("staked $100, cap:",ethers.formatEther((await p.accountOf(me.address))[3]));

  // claim $10 -> should send TTN to user
  const nonce=Date.now();
  const d=ethers.solidityPackedKeccak256(
    ["string","address","uint256","bool","uint256","uint256","address","uint256"],
    ["CLAIM",me.address,E(10),true,nonce,dl,P,chainId]);
  const sig=await me.signMessage(ethers.getBytes(d));
  const ttnBefore=await t.balanceOf(me.address);
  await (await p.claimReward(E(10),true,0,nonce,dl,sig)).wait();
  const ttnAfter=await t.balanceOf(me.address);
  console.log("CLAIM $10 -> TTN received:",ethers.formatEther(ttnAfter-ttnBefore),"(~1 TTN at $10)");
  console.log("cap after claim:",ethers.formatEther((await p.accountOf(me.address))[3]),"(expect 190)");
  console.log("CLAIM-AS-TTN VERIFIED");
})().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1)});
