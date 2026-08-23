const { ethers } = require("hardhat");
async function main() {
  const addrs = {
    TTN_TOKEN: "0x6cA29Dc3691F6a3B5bd0a7f7a2fCeD8F0BF15ffE",
    PROTOCOL: "0x98600401aadDb432cAf9698170725900829a4488",
    SECURITY: "0x130D992Dff0e12c7527A574E51501681767e6093",
    USDT: "0xe7FC10358aa09eb969054E5a8e112Cf4770BDE0E",
  };
  for (const [n, a] of Object.entries(addrs)) {
    const code = await ethers.provider.getCode(a);
    console.log(n, a, "=>", code === "0x" ? "EOA/WALLET (no code)" : `CONTRACT (${code.length} bytes)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
