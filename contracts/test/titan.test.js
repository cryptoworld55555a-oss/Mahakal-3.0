const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = (n) => ethers.parseEther(String(n));

async function signClaim(signer, kind, user, a, b, nonce, deadline, contract, chainId) {
  // kind CLAIM: a=usdtOut, b=capReduce(bool) ; kind SELL: a=ttnIn, b=minUsdtOut
  let packed;
  if (kind === "CLAIM") {
    packed = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256", "bool", "uint256", "uint256", "address", "uint256"],
      ["CLAIM", user, a, b, nonce, deadline, contract, chainId]
    );
  } else {
    packed = ethers.solidityPackedKeccak256(
      ["string", "address", "uint256", "uint256", "uint256", "uint256", "address", "uint256"],
      ["SELL", user, a, b, nonce, deadline, contract, chainId]
    );
  }
  return signer.signMessage(ethers.getBytes(packed));
}

describe("TITAN Protocol + Security", function () {
  let owner, admin, backend, user, dev, community;
  let usdt, ttn, security, protocol, router, chainId;

  beforeEach(async () => {
    [owner, admin, backend, user, dev, community] = await ethers.getSigners();
    chainId = (await ethers.provider.getNetwork()).chainId;

    usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
    ttn = await (await ethers.getContractFactory("TitanToken")).deploy(owner.address);
    security = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(admin.address);
    router = await (await ethers.getContractFactory("MockRouter")).deploy();

    protocol = await (await ethers.getContractFactory("TitanProtocol")).deploy(
      await usdt.getAddress(),
      await ttn.getAddress(),
      await security.getAddress(),
      backend.address,
      dev.address,
      community.address,
      owner.address
    );
    await protocol.setRouter(await router.getAddress());
    await ttn.setWhitelisted(await protocol.getAddress(), true);

    // Fund router with TTN (for buy) and USDT (for sell), and give user USDT.
    await ttn.transfer(await router.getAddress(), E(100000));
    await usdt.transfer(await router.getAddress(), E(100000));
    await usdt.transfer(user.address, E(5000));
    await usdt.connect(user).approve(await protocol.getAddress(), ethers.MaxUint256);
    // pre-fund protocol USDT reward reserve for claim tests
    await usdt.transfer(await protocol.getAddress(), E(1000));
  });

  it("register + stake splits 60/5/35 and grants 200% mining cap", async () => {
    await protocol.connect(user).register();
    const devBefore = await usdt.balanceOf(dev.address);
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256);

    // dev got 5% = $5
    expect(await usdt.balanceOf(dev.address)).to.equal(devBefore + E(5));
    // router received 60% = $60 USDT (the reserve buy)
    // mining cap = 200% of $100 = $200
    const acc = await protocol.accountOf(user.address);
    expect(acc[3]).to.equal(E(200));
    // TTN reserve stored in protocol = $60 worth (1:1) = 60 TTN
    expect(await ttn.balanceOf(await protocol.getAddress())).to.equal(E(60));
  });

  it("blocked user cannot stake", async () => {
    await protocol.connect(user).register();
    await security.connect(admin).blockUser(user.address);
    await expect(protocol.connect(user).stake(E(100), 0, ethers.MaxUint256)).to.be.revertedWith("user blocked");
    await security.connect(admin).unblockUser(user.address);
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // now works
  });

  it("global pause halts staking", async () => {
    await protocol.connect(user).register();
    await security.connect(admin).pause();
    await expect(protocol.connect(user).stake(E(100), 0, ethers.MaxUint256)).to.be.revertedWith("system paused");
  });

  it("signed reward claim pays USDT and reduces cap; nonce cannot be reused", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // cap $200
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const addr = await protocol.getAddress();
    const sig = await signClaim(backend, "CLAIM", user.address, E(20), true, 1, deadline, addr, chainId);

    const ttnBefore = await ttn.balanceOf(user.address);
    await protocol.connect(user).claimReward(E(20), true, 0, 1, deadline, sig);
    expect(await ttn.balanceOf(user.address)).to.equal(ttnBefore + E(20)); // reward delivered as TTN (1:1 mock)
    const acc = await protocol.accountOf(user.address);
    expect(acc[3]).to.equal(E(180)); // 200 - 20 (capReduce)

    // reuse -> revert
    await expect(protocol.connect(user).claimReward(E(20), true, 0, 1, deadline, sig)).to.be.revertedWith("nonce used");
  });

  it("claim with capReduce fails when cap insufficient (no cap = no reward)", async () => {
    await protocol.connect(user).register();
    // no stake -> cap 0
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const addr = await protocol.getAddress();
    const sig = await signClaim(backend, "CLAIM", user.address, E(5), true, 7, deadline, addr, chainId);
    await expect(protocol.connect(user).claimReward(E(5), true, 0, 7, deadline, sig)).to.be.revertedWith("no mining cap");
  });

  it("sellMined swaps TTN->USDT and reduces cap by USD received", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // cap $200, 60 TTN reserve in protocol
    // user must hold TTN and approve protocol to sell their mined TTN
    await ttn.transfer(user.address, E(50));
    await ttn.connect(user).approve(await protocol.getAddress(), ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const addr = await protocol.getAddress();
    const sig = await signClaim(backend, "SELL", user.address, E(30), E(1), 2, deadline, addr, chainId);

    const balBefore = await usdt.balanceOf(user.address);
    await protocol.connect(user).sellMined(E(30), E(1), 2, deadline, sig);
    expect(await usdt.balanceOf(user.address)).to.equal(balBefore + E(30)); // 1:1
    const acc = await protocol.accountOf(user.address);
    expect(acc[3]).to.equal(E(170)); // 200 - 30
  });

  it("TTN transfers restricted: user cannot send to random wallet, only to protocol", async () => {
    await ttn.transfer(user.address, E(10)); // owner is whitelisted -> allowed
    await expect(ttn.connect(user).transfer(dev.address, E(1))).to.be.revertedWith("TTN: transfers restricted");
    await ttn.connect(user).transfer(await protocol.getAddress(), E(1)); // to = protocol (whitelisted) -> allowed
    expect(await ttn.balanceOf(await protocol.getAddress())).to.be.greaterThan(0);
  });

  it("stake rejects below min / non-multiples / over daily cap", async () => {
    await protocol.connect(user).register();
    await expect(protocol.connect(user).stake(E(5), 0, ethers.MaxUint256)).to.be.revertedWith("below min");
    await expect(protocol.connect(user).stake(E(15), 0, ethers.MaxUint256)).to.be.revertedWith("not multiple of step");
    await expect(protocol.connect(user).stake(E(2000), 0, ethers.MaxUint256)).to.be.revertedWith("above daily max");
  });
});
