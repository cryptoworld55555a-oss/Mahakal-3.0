// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MainProtocol
 * @notice Module 1 skeleton: activation (USDT deposit), user registry, orchestration.
 * @dev Wires PoolManager / CommunityFund / RewardEngine addresses (config-driven).
 *      Business logic for splits/referrals lands in later modules.
 */
contract MainProtocol is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    uint256 public constant MIN_ACTIVATION = 10e18; // $10, no upper cap

    address public poolManager;
    address public communityFund;
    address public rewardEngine;

    struct Account {
        bool active;
        uint256 activatedAt;
        uint256 totalDeposited;
    }

    mapping(address => Account) public accounts;
    uint256 public totalActivatedUsers;

    event Activated(address indexed user, uint256 amount, uint256 timestamp);
    event ModulesWired(address poolManager, address communityFund, address rewardEngine);

    constructor(address _usdt) Ownable(msg.sender) {
        require(_usdt != address(0), "usdt=0");
        usdt = IERC20(_usdt);
    }

    function wireModules(address _poolManager, address _communityFund, address _rewardEngine)
        external
        onlyOwner
    {
        poolManager = _poolManager;
        communityFund = _communityFund;
        rewardEngine = _rewardEngine;
        emit ModulesWired(_poolManager, _communityFund, _rewardEngine);
    }

    /// @notice Activate an ID by depositing USDT (min $10, no upper cap).
    function activate(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_ACTIVATION, "below minimum");
        usdt.safeTransferFrom(msg.sender, address(this), amount);

        Account storage a = accounts[msg.sender];
        if (!a.active) {
            a.active = true;
            a.activatedAt = block.timestamp;
            totalActivatedUsers += 1;
        }
        a.totalDeposited += amount;

        // NOTE: distribution split to pools/fund handled in later modules.
        emit Activated(msg.sender, amount, block.timestamp);
    }

    function isActive(address user) external view returns (bool) {
        return accounts[user].active;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
