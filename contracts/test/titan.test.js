const { expect } = require("chai");
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

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
      await security.getAddress(),
      backend.address,
      dev.address,
      community.address,
      owner.address
    );
    await protocol.setToken(await ttn.getAddress());
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

  it("renewal: $10 fee after 200 days; isRenewalDue flips correctly", async () => {
    await protocol.connect(user).register();
    expect(await protocol.isRenewalDue(user.address)).to.equal(false);

    await ethers.provider.send("evm_increaseTime", [201 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    expect(await protocol.isRenewalDue(user.address)).to.equal(true);

    const devBefore = await usdt.balanceOf(dev.address);
    await protocol.connect(user).renew();
    expect((await usdt.balanceOf(dev.address)) - devBefore).to.equal(E(10)); // $10 fee to dev
    expect(await protocol.isRenewalDue(user.address)).to.equal(false); // reset after renew
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

  it("permissionless sell reduces cap by actual USDT received (cap only reduces on sell)", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // cap $200
    await ttn.transfer(user.address, E(50)); // owner (whitelisted) gives user some TTN
    await ttn.connect(user).approve(await protocol.getAddress(), ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const balBefore = await usdt.balanceOf(user.address);
    await protocol.connect(user).sell(E(30), E(1), deadline);
    const usdtGot = (await usdt.balanceOf(user.address)) - balBefore;
    expect(usdtGot).to.be.gt(0);
    const acc = await protocol.accountOf(user.address);
    expect(acc[3]).to.equal(E(200) - usdtGot); // cap reduced by exactly the USDT received
  });

  it("TTN transfers restricted: user cannot send to random wallet, only to protocol", async () => {
    await ttn.transfer(user.address, E(10)); // owner is whitelisted -> allowed
    await expect(ttn.connect(user).transfer(dev.address, E(1))).to.be.revertedWith("TTN: transfers restricted");
    await ttn.connect(user).transfer(await protocol.getAddress(), E(1)); // to = protocol (whitelisted) -> allowed
    expect(await ttn.balanceOf(await protocol.getAddress())).to.be.greaterThan(0);
  });

  it("permissionless sell: user sells own TTN for USDT (no signature), cap reduces, blocked user cannot", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // cap $200
    await ttn.transfer(user.address, E(50));
    await ttn.connect(user).approve(await protocol.getAddress(), ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    const usdtBefore = await usdt.balanceOf(user.address);
    await protocol.connect(user).sell(E(30), 0, deadline); // NO signature
    expect(await usdt.balanceOf(user.address)).to.equal(usdtBefore + E(30)); // 1:1 mock
    expect((await protocol.accountOf(user.address))[3]).to.equal(E(170)); // 200 - 30

    // blocked user cannot sell
    await security.connect(admin).blockUser(user.address);
    await expect(protocol.connect(user).sell(E(1), 0, deadline)).to.be.revertedWith("user blocked");
  });

  it("stake rejects below min / non-multiples / over daily cap", async () => {
    await protocol.connect(user).register();
    await expect(protocol.connect(user).stake(E(5), 0, ethers.MaxUint256)).to.be.revertedWith("below min");
    await expect(protocol.connect(user).stake(E(15), 0, ethers.MaxUint256)).to.be.revertedWith("not multiple of step");
    await expect(protocol.connect(user).stake(E(2000), 0, ethers.MaxUint256)).to.be.revertedWith("above daily max");
  });

  it("Merkle claim: user claims own leaf (no backend sig), gets TTN at live price, cap UNCHANGED (cap only reduces on sell)", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256); // cap $200
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    // Backend computes rewards off-chain and builds a Merkle tree. It signs NOTHING.
    // Leaf = [user, category, cumulativeUsd]. category: 1=Level 2=Daily. dev is a filler leaf.
    const values = [
      [user.address, "1", E(20).toString()],
      [user.address, "2", E(8).toString()],
      [dev.address, "1", E(3).toString()],
    ];
    const tree = StandardMerkleTree.of(values, ["address", "uint8", "uint256"]);
    await protocol.setMerkleRoot(tree.root); // owner/multisig posts root
    expect(await protocol.rewardEpoch()).to.equal(1n);

    const proofLevel = tree.getProof([user.address, "1", E(20).toString()]);
    const proofDaily = tree.getProof([user.address, "2", E(8).toString()]);

    const ttnBefore = await ttn.balanceOf(user.address);
    await protocol.connect(user).claimLevelIncome(E(20), 0, deadline, proofLevel);
    expect(await ttn.balanceOf(user.address)).to.equal(ttnBefore + E(20)); // 1:1 mock (live price)
    expect((await protocol.accountOf(user.address))[3]).to.equal(E(200)); // cap UNCHANGED by claim

    await protocol.connect(user).claimDailyPool(E(8), 0, deadline, proofDaily);
    expect(await ttn.balanceOf(user.address)).to.equal(ttnBefore + E(28));
    expect((await protocol.accountOf(user.address))[3]).to.equal(E(200)); // still unchanged
  });

  it("Merkle claim: cumulative pays only delta; re-claim same amount reverts; forged proof reverts", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    // Epoch 1: cumulative $10 (Level category)
    let tree = StandardMerkleTree.of([[user.address, "1", E(10).toString()]], ["address", "uint8", "uint256"]);
    await protocol.setMerkleRoot(tree.root);
    await protocol.connect(user).claimLevelIncome(E(10), 0, deadline, tree.getProof([user.address, "1", E(10).toString()]));
    expect((await protocol.accountOf(user.address))[3]).to.equal(E(200)); // claim never touches cap

    // re-claim same cumulative -> nothing new
    await expect(
      protocol.connect(user).claimLevelIncome(E(10), 0, deadline, tree.getProof([user.address, "1", E(10).toString()]))
    ).to.be.revertedWith("nothing to claim");

    // Epoch 2: cumulative grows to $25 -> pays only delta $15
    tree = StandardMerkleTree.of([[user.address, "1", E(25).toString()]], ["address", "uint8", "uint256"]);
    await protocol.setMerkleRoot(tree.root);
    const ttnBefore = await ttn.balanceOf(user.address);
    await protocol.connect(user).claimLevelIncome(E(25), 0, deadline, tree.getProof([user.address, "1", E(25).toString()]));
    expect(await ttn.balanceOf(user.address)).to.equal(ttnBefore + E(15)); // delta only
    expect((await protocol.accountOf(user.address))[3]).to.equal(E(200)); // cap still unchanged by claim

    // forged amount (not in tree) -> bad proof
    await expect(
      protocol.connect(user).claimLevelIncome(E(999), 0, deadline, tree.getProof([user.address, "1", E(25).toString()]))
    ).to.be.revertedWith("bad proof");
  });

  it("Merkle claim: per-category buckets are independent (Daily claim does not touch Level bucket)", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const values = [
      [user.address, "1", E(10).toString()], // Level
      [user.address, "2", E(5).toString()],  // Daily
    ];
    const tree = StandardMerkleTree.of(values, ["address", "uint8", "uint256"]);
    await protocol.setMerkleRoot(tree.root);
    const ttnBefore = await ttn.balanceOf(user.address);
    await protocol.connect(user).claimDailyPool(E(5), 0, deadline, tree.getProof([user.address, "2", E(5).toString()]));
    // Level bucket still fully claimable after a Daily claim
    await protocol.connect(user).claimLevelIncome(E(10), 0, deadline, tree.getProof([user.address, "1", E(10).toString()]));
    expect(await ttn.balanceOf(user.address)).to.equal(ttnBefore + E(15));
    expect(await protocol.claimedByCategory(user.address, 1)).to.equal(E(10));
    expect(await protocol.claimedByCategory(user.address, 2)).to.equal(E(5));
  });

  it("Merkle claim: blocked user cannot claim", async () => {
    await protocol.connect(user).register();
    await protocol.connect(user).stake(E(100), 0, ethers.MaxUint256);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    const tree = StandardMerkleTree.of([[user.address, "1", E(10).toString()]], ["address", "uint8", "uint256"]);
    await protocol.setMerkleRoot(tree.root);
    await security.connect(admin).blockUser(user.address);
    await expect(
      protocol.connect(user).claimLevelIncome(E(10), 0, deadline, tree.getProof([user.address, "1", E(10).toString()]))
    ).to.be.revertedWith("user blocked");
  });

  it("MAINNET FLOW: token mints entire supply DIRECTLY to protocol (no wallet holds supply)", async () => {
    // Deploy fresh: protocol first (no token), then token minting supply straight to protocol.
    const usdt2 = await (await ethers.getContractFactory("MockUSDT")).deploy();
    const sec2 = await (await ethers.getContractFactory("TitanSecurityAdmin")).deploy(admin.address);
    const router2 = await (await ethers.getContractFactory("MockRouter")).deploy();
    const proto2 = await (await ethers.getContractFactory("TitanProtocol")).deploy(
      await usdt2.getAddress(), await sec2.getAddress(),
      backend.address, dev.address, community.address, owner.address
    );
    // Token deployed AFTER protocol, treasury = protocol => supply minted directly to the contract.
    const ttn2 = await (await ethers.getContractFactory("TitanToken")).deploy(await proto2.getAddress());

    const MAX = E(200000);
    // The token's FIRST and ONLY supply movement is the mint to the protocol contract.
    expect(await ttn2.balanceOf(await proto2.getAddress())).to.equal(MAX);
    expect(await ttn2.balanceOf(owner.address)).to.equal(0n);

    // Link + one-time guard.
    await proto2.setToken(await ttn2.getAddress());
    await expect(proto2.setToken(await ttn2.getAddress())).to.be.revertedWith("token already set");

    // Seed liquidity from the contract's OWN held TTN; LP burned to dead address.
    await proto2.setRouter(await router2.getAddress());
    await usdt2.approve(await proto2.getAddress(), ethers.MaxUint256);
    const dead = "0x000000000000000000000000000000000000dEaD";
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await proto2.seedLiquidity(E(20000), E(20000), dead, dl);
    // TTN left the contract only via the router (contract -> pool), never via a personal wallet.
    expect(await ttn2.balanceOf(await proto2.getAddress())).to.equal(MAX - E(20000));
    expect(await ttn2.balanceOf(await router2.getAddress())).to.equal(E(20000));
    expect(await ttn2.balanceOf(owner.address)).to.equal(0n);
  });

  it("rootPoster operator can post Merkle roots without being owner (owner keeps control)", async () => {
    // Non-owner, non-rootPoster cannot post.
    await expect(protocol.connect(user).setMerkleRoot(ethers.ZeroHash)).to.be.revertedWith("not authorized");
    // Owner designates a low-power operator wallet.
    await protocol.setRootPoster(backend.address);
    // Operator can now post roots (no ownership, no fund access).
    await expect(protocol.connect(backend).setMerkleRoot(ethers.id("root1"))).to.not.be.reverted;
    expect(await protocol.merkleRoot()).to.equal(ethers.id("root1"));
    // But operator still cannot touch owner-only admin (e.g. setRootPoster).
    await expect(protocol.connect(backend).setRootPoster(user.address)).to.be.reverted;
  });
});
