const { ethers } = require("hardhat");
const DEAD="0x000000000000000000000000000000000000dEaD";
const PAIR="0x6dcA2ADFC95EAd29C61C8D12D4c391a6B865bFFe";
const ABI=["function balanceOf(address) view returns (uint256)","function totalSupply() view returns (uint256)"];
async function main(){
  const [d]=await ethers.getSigners();
  const p=new ethers.Contract(PAIR,ABI,d);
  console.log("My LP now:", ethers.formatEther(await p.balanceOf(d.address)));
  console.log("Dead LP now:", ethers.formatEther(await p.balanceOf(DEAD)));
  console.log("Total supply:", ethers.formatEther(await p.totalSupply()));
}
main().catch(e=>{console.error(e);process.exit(1);});
