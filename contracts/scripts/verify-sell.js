const { ethers } = require("hardhat");
const P="0xf8eaf47A1Ee1a2f60f817743fCD72D33665ed537";
const T="0x619bB948d0f436287e50FAd36D536f3c2CA6C08e";
const U="0x88D326d04940433e27cBD9749e485223715bB397";
const ROUTER="0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const E=(n)=>ethers.parseEther(String(n));
const RABI=["function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)"];
(async()=>{
  const [me]=await ethers.getSigners();
  const p=await ethers.getContractAt("TitanProtocol",P);
  const t=await ethers.getContractAt("TitanToken",T);
  const u=await ethers.getContractAt("MockUSDT",U);
  const r=new ethers.Contract(ROUTER,RABI,me);
  const dl=Math.floor(Date.now()/1000)+1800;
  await (await u.faucet(E(20000))).wait();
  await (await t.approve(ROUTER,E(1000))).wait();
  await (await u.approve(ROUTER,E(10000))).wait();
  await (await r.addLiquidity(T,U,E(1000),E(10000),0,0,me.address,dl)).wait();
  try{await (await p.register()).wait();}catch(e){}
  await (await u.approve(P,ethers.MaxUint256)).wait();
  await (await p.stake(E(100),0,dl)).wait();
  const capAfterStake=(await p.accountOf(me.address))[3];
  console.log("cap after stake:",ethers.formatEther(capAfterStake));
  // PERMISSIONLESS SELL - no signature
  await (await t.approve(P,ethers.MaxUint256)).wait();
  const uBefore=await u.balanceOf(me.address);
  const tx=await p.sell(E(5),0,dl);
  await tx.wait();
  console.log("permissionless sell tx:",tx.hash,"SUCCESS (no signature)");
})().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1)});
