const { ethers } = require("hardhat");
const P = "0x98600401aadDb432cAf9698170725900829a4488";
const T = "0x6cA29Dc3691F6a3B5bd0a7f7a2fCeD8F0BF15ffE";
const TX = "0x8cf7db4a996c112dd7bf55fb757fe77fcd58f20a6ce82e46c3e81a543f14ce3b";
async function main() {
  const [d] = await ethers.getSigners();
  const protocol = await ethers.getContractAt("TitanProtocol", P);
  const ttn = await ethers.getContractAt("TitanToken", T);
  const rcpt = await ethers.provider.getTransactionReceipt(TX);
  console.log("claim receipt status:", rcpt ? rcpt.status : "null", "logs:", rcpt ? rcpt.logs.length : 0);
  console.log("cap now:", ethers.formatEther((await protocol.accountOf(d.address))[3]));
  console.log("claimedReducingUsd:", ethers.formatEther(await protocol.claimedReducingUsd(d.address)));
  console.log("deployer TTN:", ethers.formatEther(await ttn.balanceOf(d.address)));
  console.log("merkleRoot:", await protocol.merkleRoot());
}
main().catch((e) => { console.error(e); process.exit(1); });
