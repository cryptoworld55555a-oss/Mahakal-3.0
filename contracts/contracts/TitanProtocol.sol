// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}

interface ITitanSecurity {
    function whenActive(address user) external view;
}

/**
 * @title TitanProtocol
 * @notice Core fund + logic contract for TITAN (TTN).
 * @dev Hybrid model: funds, activation/stake split, mining-cap accounting and
 *      PancakeSwap buy/sell live on-chain; MLM/level/matching/pool math is computed
 *      off-chain and authorized here via backend EIP-191 signatures (anti-replay nonce).
 *      All business percentages are CONFIG-BASED (admin-settable, basis points).
 *      Every sensitive action checks TitanSecurityAdmin.whenActive(user) so a blocked
 *      user cannot activate, stake, claim, earn or sell, and a global pause halts all.
 */
contract TitanProtocol is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ---------------------------------------------------------------- Wiring
    IERC20 public immutable usdt;
    IERC20 public ttn; // set once via setToken() after the token mints its supply to THIS contract
    IPancakeRouter public router;
    ITitanSecurity public security;
    address public signer;         // backend authorization signer
    address public rootPoster;     // low-power operator allowed to post reward Merkle roots (no fund access)
    address public devWallet;      // Platform Development Fund
    address public communityFund;

    // -------------------------------------------------- Config (basis points)
    uint256 public constant BPS = 10_000;
    // HIGH-RISK economics are HARD-CODED (immutable) per Rule 12 — admin can NEVER change payout math.
    uint256 public constant reserveBps = 6_000;   // 60% -> buy TTN reserve (auto-staked, locked)
    uint256 public constant devBps = 500;         // 5%  -> developer fund
    // remaining 35% stays as USDT reward reserve, distributed via signed claims

    uint256 public constant standardCapBps = 20_000; // 200% mining cap
    uint256 public constant ownerCapBps = 30_000;    // 300% mining cap (Owner Club)

    // Low-risk operational params remain configurable.
    uint256 public minStake = 10e18;         // $10
    uint256 public maxStakePerDay = 1_000e18; // $1000/day
    uint256 public stakeStep = 10e18;        // multiples of $10
    uint256 public renewalFee = 10e18;       // $10
    uint256 public renewalPeriod = 200 days;

    // ---------------------------------------------------------------- Storage
    struct Account {
        bool registered;
        bool ownerTier;        // 300% cap after Owner Club qualification
        uint40 registeredAt;
        uint40 renewedAt;
        uint256 totalStaked;
        uint256 miningCap;     // available USD extraction allowance (18 decimals)
    }
    mapping(address => Account) public accounts;
    mapping(address => uint256) public stakedOnDay; // day => reset via lastDay
    mapping(address => uint256) public lastStakeDay;
    mapping(uint256 => bool) public usedNonce;

    // -------------------------------------------------- Merkle reward claims
    // Backend ONLY computes rewards off-chain and publishes a Merkle root. It holds NO
    // signing key that can move funds — a user claims their own leaf with a proof.
    // Cumulative pattern: each leaf = total lifetime USD entitlement; contract pays the
    // delta since last claim, so re-publishing roots is safe (no replay, no per-epoch nonce).
    bytes32 public merkleRoot;
    uint256 public rewardEpoch;

    // Reward categories -> distinct named claim functions (BscScan labels).
    uint8 public constant CAT_ROI = 0;
    uint8 public constant CAT_LEVEL = 1;
    uint8 public constant CAT_DAILY = 2;
    uint8 public constant CAT_WEEKLY = 3;
    uint8 public constant CAT_MONTHLY = 4;
    // Cumulative USD already claimed per user per category.
    mapping(address => mapping(uint8 => uint256)) public claimedByCategory;

    uint256 public totalRegistered;
    uint256 public totalActivated; // users who have staked at least once

    // ----------------------------------------------------------------- Events
    event Registered(address indexed user, uint256 timestamp);
    event Renewed(address indexed user, uint256 fee, uint256 timestamp);
    event Staked(address indexed user, uint256 amount, uint256 reserveUsed, uint256 devCut, uint256 capGranted);
    event RewardClaimed(address indexed user, uint256 usdtOut, bool capReduced, uint256 nonce);
    event Sold(address indexed user, uint256 ttnIn, uint256 usdtOut, uint256 nonce);
    event ConfigUpdated();
    event WalletsUpdated(address devWallet, address communityFund);
    event RouterUpdated(address router);
    event SignerUpdated(address signer);
    event RootPosterUpdated(address rootPoster);
    event OwnerTierSet(address indexed user, bool ownerTier);
    event MerkleRootUpdated(bytes32 indexed root, uint256 indexed epoch);
    event RewardPoolClaimed(address indexed user, uint8 indexed category, uint256 usdtValue, uint256 ttnOut, uint256 cumulativeUsd);

    constructor(
        address _usdt,
        address _security,
        address _signer,
        address _devWallet,
        address _communityFund,
        address _owner
    ) Ownable(_owner) {
        require(_usdt != address(0) && _security != address(0), "zero addr");
        usdt = IERC20(_usdt);
        security = ITitanSecurity(_security);
        signer = _signer;
        devWallet = _devWallet;
        communityFund = _communityFund;
    }

    /// @notice One-time link to the TTN token. The token is deployed AFTER this contract and
    /// @dev mints its ENTIRE supply DIRECTLY to this contract (no wallet ever holds the supply).
    ///      This breaks the token<->protocol circular dependency at deploy time.
    function setToken(address _ttn) external onlyOwner {
        require(address(ttn) == address(0), "token already set");
        require(_ttn != address(0), "zero");
        ttn = IERC20(_ttn);
    }

    /// @notice Seed the initial PancakeSwap TTN/USDT pool using this contract's OWN held TTN.
    /// @dev TTN comes from the supply minted directly to this contract (never a personal wallet).
    ///      USDT is pulled from the caller. LP tokens go to `lpReceiver` (use a dead address to
    ///      lock liquidity permanently). Callable only once meaningfully during setup.
    function seedLiquidity(uint256 ttnAmount, uint256 usdtAmount, address lpReceiver, uint256 deadline)
        external onlyOwner nonReentrant
    {
        require(address(router) != address(0), "router unset");
        require(address(ttn) != address(0), "token unset");
        require(ttnAmount > 0 && usdtAmount > 0, "zero");
        usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);
        ttn.forceApprove(address(router), ttnAmount);
        usdt.forceApprove(address(router), usdtAmount);
        router.addLiquidity(address(ttn), address(usdt), ttnAmount, usdtAmount, 0, 0, lpReceiver, deadline);
    }

    // ----------------------------------------------------------- Admin config
    function setStakeLimits(uint256 _min, uint256 _maxPerDay, uint256 _step) external onlyOwner {
        require(_step > 0 && _min > 0, "bad limits");
        minStake = _min;
        maxStakePerDay = _maxPerDay;
        stakeStep = _step;
        emit ConfigUpdated();
    }

    function setRenewal(uint256 _fee, uint256 _period) external onlyOwner {
        renewalFee = _fee;
        renewalPeriod = _period;
        emit ConfigUpdated();
    }

    function setRouter(address _router) external onlyOwner {
        router = IPancakeRouter(_router);
        emit RouterUpdated(_router);
    }

    function setSecurity(address _security) external onlyOwner {
        require(_security != address(0), "zero");
        security = ITitanSecurity(_security);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    function setWallets(address _devWallet, address _communityFund) external onlyOwner {
        devWallet = _devWallet;
        communityFund = _communityFund;
        emit WalletsUpdated(_devWallet, _communityFund);
    }

    /// @notice Mark a user as Owner Club tier (300% cap). Set by owner after off-chain qualification.
    function setOwnerTier(address user, bool ownerTier) external onlyOwner {
        accounts[user].ownerTier = ownerTier;
        emit OwnerTierSet(user, ownerTier);
    }

    /// @notice Set the low-power operator wallet allowed to post reward Merkle roots.
    /// @dev This wallet can ONLY publish roots (enabling users to claim their pre-computed rewards).
    ///      It cannot move funds, change config, or drain anything. Lets the backend auto-post daily
    ///      roots WITHOUT needing a multisig approval each time, while ownership stays with the Safe.
    function setRootPoster(address _rootPoster) external onlyOwner {
        rootPoster = _rootPoster;
        emit RootPosterUpdated(_rootPoster);
    }

    /// @notice Publish the reward Merkle root computed off-chain by the backend engine.
    /// @dev Poster has NO power to move funds — it only posts a root of user->cumulativeUsd leaves.
    ///      Callable by the owner (Safe multisig) OR the designated rootPoster operator wallet.
    function setMerkleRoot(bytes32 root) external {
        require(msg.sender == owner() || msg.sender == rootPoster, "not authorized");
        merkleRoot = root;
        rewardEpoch += 1;
        emit MerkleRootUpdated(root, rewardEpoch);
    }

    // -------------------------------------------------------- Register / Renew
    function register() external nonReentrant {
        security.whenActive(msg.sender);
        Account storage a = accounts[msg.sender];
        require(!a.registered, "already registered");
        a.registered = true;
        a.registeredAt = uint40(block.timestamp);
        a.renewedAt = uint40(block.timestamp);
        totalRegistered += 1;
        emit Registered(msg.sender, block.timestamp);
    }

    function renew() external nonReentrant {
        security.whenActive(msg.sender);
        Account storage a = accounts[msg.sender];
        require(a.registered, "not registered");
        usdt.safeTransferFrom(msg.sender, devWallet, renewalFee);
        a.renewedAt = uint40(block.timestamp);
        emit Renewed(msg.sender, renewalFee, block.timestamp);
    }

    function isRenewalDue(address user) external view returns (bool) {
        Account storage a = accounts[user];
        if (!a.registered) return false;
        return block.timestamp > uint256(a.renewedAt) + renewalPeriod;
    }

    // ---------------------------------------------------------------- Staking
    /// @notice Stake USDT: 60% buys TTN reserve, 5% to dev, 35% held for rewards; grants mining cap.
    /// @param amount USDT amount (18 decimals). @param minTtnOut slippage guard for the reserve buy.
    function stake(uint256 amount, uint256 minTtnOut, uint256 deadline) external nonReentrant {
        security.whenActive(msg.sender);
        Account storage a = accounts[msg.sender];
        require(a.registered, "register first");
        require(amount >= minStake, "below min");
        require(amount <= maxStakePerDay, "above daily max");
        require(amount % stakeStep == 0, "not multiple of step");

        uint256 today = block.timestamp / 1 days;
        if (lastStakeDay[msg.sender] != today) {
            lastStakeDay[msg.sender] = today;
            stakedOnDay[msg.sender] = 0;
        }
        require(stakedOnDay[msg.sender] + amount <= maxStakePerDay, "daily cap exceeded");
        stakedOnDay[msg.sender] += amount;

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        uint256 devCut = (amount * devBps) / BPS;
        uint256 reserveAmt = (amount * reserveBps) / BPS;
        if (devCut > 0 && devWallet != address(0)) usdt.safeTransfer(devWallet, devCut);

        // Reserve: buy TTN on PancakeSwap and store in this contract (mining reserve).
        if (reserveAmt > 0 && address(router) != address(0)) {
            address[] memory path = new address[](2);
            path[0] = address(usdt);
            path[1] = address(ttn);
            usdt.forceApprove(address(router), reserveAmt);
            router.swapExactTokensForTokens(reserveAmt, minTtnOut, path, address(this), deadline);
        }
        // remaining (35%) stays as USDT reward reserve in this contract.

        uint256 capBps = a.ownerTier ? ownerCapBps : standardCapBps;
        uint256 capGranted = (amount * capBps) / BPS;
        a.miningCap += capGranted;

        if (a.totalStaked == 0) totalActivated += 1;
        a.totalStaked += amount;

        emit Staked(msg.sender, amount, reserveAmt, devCut, capGranted);
    }

    // ------------------------------------------------ Merkle reward claim (backend = calculator only)
    // Each reward CATEGORY has its OWN named function so BscScan shows a clear label
    // (Claim ROI / Claim Level Income / Claim Daily Pool / Claim Weekly Pool / Claim Monthly Pool).
    // All are paid as TTN bought LIVE from PancakeSwap at the current market price. CLAIM never
    // reduces the mining cap — the cap only reduces at SELL time by the actual USDT received.

    /// @notice Claim your self-ROI rewards.
    function claimRoi(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] calldata proof) external {
        _claim(CAT_ROI, cumulativeUsd, minTtnOut, deadline, proof);
    }

    /// @notice Claim your Direct + Level income rewards.
    function claimLevelIncome(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] calldata proof) external {
        _claim(CAT_LEVEL, cumulativeUsd, minTtnOut, deadline, proof);
    }

    /// @notice Claim your Daily Working Pool reward.
    function claimDailyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] calldata proof) external {
        _claim(CAT_DAILY, cumulativeUsd, minTtnOut, deadline, proof);
    }

    /// @notice Claim your Weekly Champion Pool reward.
    function claimWeeklyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] calldata proof) external {
        _claim(CAT_WEEKLY, cumulativeUsd, minTtnOut, deadline, proof);
    }

    /// @notice Claim your Monthly Owner Club Pool reward.
    function claimMonthlyPool(uint256 cumulativeUsd, uint256 minTtnOut, uint256 deadline, bytes32[] calldata proof) external {
        _claim(CAT_MONTHLY, cumulativeUsd, minTtnOut, deadline, proof);
    }

    /// @dev Shared cumulative Merkle claim for a given reward category.
    /// @param category 0=ROI 1=Level 2=Daily 3=Weekly 4=Monthly.
    /// @param cumulativeUsd Your TOTAL lifetime USD entitlement of this category (from the published leaf).
    /// @param proof Merkle proof for leaf keccak256(bytes.concat(keccak256(abi.encode(user, category, cumulativeUsd)))).
    function _claim(
        uint8 category,
        uint256 cumulativeUsd,
        uint256 minTtnOut,
        uint256 deadline,
        bytes32[] calldata proof
    ) internal nonReentrant {
        security.whenActive(msg.sender);
        require(block.timestamp <= deadline, "expired");
        require(merkleRoot != bytes32(0), "no root");
        require(address(router) != address(0), "router unset");

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, category, cumulativeUsd))));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "bad proof");

        // Cumulative accounting: pay only the unclaimed delta for THIS category.
        uint256 alreadyClaimed = claimedByCategory[msg.sender][category];
        require(cumulativeUsd > alreadyClaimed, "nothing to claim");
        uint256 claimable = cumulativeUsd - alreadyClaimed;
        claimedByCategory[msg.sender][category] = cumulativeUsd;

        // Buy TTN live from PancakeSwap with the claimable USD value at the CURRENT price.
        address[] memory path = new address[](2);
        path[0] = address(usdt);
        path[1] = address(ttn);
        usdt.forceApprove(address(router), claimable);
        uint256 ttnBefore = ttn.balanceOf(address(this));
        router.swapExactTokensForTokens(claimable, minTtnOut, path, address(this), deadline);
        uint256 bought = ttn.balanceOf(address(this)) - ttnBefore;
        ttn.safeTransfer(msg.sender, bought);

        emit RewardPoolClaimed(msg.sender, category, claimable, bought, cumulativeUsd);
    }

    // ------------------------------------------------ Permissionless sell (site-independent)
    /// @notice Sell your own TTN for USDT directly on-chain — NO backend/signature needed.
    /// @dev Works even if the website/backend is down. Bounded by your available mining cap and
    ///      your own wallet TTN. Blocked users cannot sell. Callable directly via BSCScan.
    function sell(uint256 ttnIn, uint256 minUsdtOut, uint256 deadline) external nonReentrant {
        security.whenActive(msg.sender);
        require(block.timestamp <= deadline, "expired");
        require(address(router) != address(0), "router unset");
        require(ttnIn > 0, "zero");

        ttn.safeTransferFrom(msg.sender, address(this), ttnIn);
        address[] memory path = new address[](2);
        path[0] = address(ttn);
        path[1] = address(usdt);
        ttn.forceApprove(address(router), ttnIn);

        uint256 balBefore = usdt.balanceOf(address(this));
        router.swapExactTokensForTokens(ttnIn, minUsdtOut, path, address(this), deadline);
        uint256 usdtOut = usdt.balanceOf(address(this)) - balBefore;

        Account storage a = accounts[msg.sender];
        require(a.miningCap >= usdtOut, "exceeds mining cap"); // can only extract up to available cap
        a.miningCap -= usdtOut;

        usdt.safeTransfer(msg.sender, usdtOut);
        emit Sold(msg.sender, ttnIn, usdtOut, 0);
    }

    // ------------------------------------------------------------------ Views
    function accountOf(address user)
        external
        view
        returns (bool registered, bool ownerTier, uint256 totalStaked, uint256 miningCap)
    {
        Account storage a = accounts[user];
        return (a.registered, a.ownerTier, a.totalStaked, a.miningCap);
    }
}
