const { ethers } = require("hardhat");
async function main() {
  const p = await ethers.getContractAt("TitanProtocol", "0x53F278bfCa7acED4c41734FF78840d52fdFD1a6f");
  console.log("USDT=", await p.usdt());
  console.log("TTN=", await p.ttn());
  console.log("SECURITY=", await p.security());
  console.log("COMMUNITY=", await p.communityFund());
}
main().catch(e => { console.error(e.shortMessage||e.message); process.exit(1); });
