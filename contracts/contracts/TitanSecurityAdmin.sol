// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TitanSecurityAdmin
 * @notice Security & control center for the TITAN ecosystem.
 * @dev Holds NO user funds. Only manages permissions, block/unblock, emergency
 *      pause/resume, approved-contract registry and protected system wallets.
 *      All other TITAN contracts should query this before any sensitive action:
 *        - `whenActive(user)`  -> reverts if globally paused or user blocked.
 *        - `onlyApprovedCaller` -> reverts if caller is not an approved contract.
 *      Assign DEFAULT_ADMIN_ROLE to a multi-sig for high-risk actions.
 */
contract TitanSecurityAdmin is AccessControl, Pausable {
    // ------------------------------------------------------------------ Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");   // block/unblock, wallets, approvals
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE"); // emergency stop / resume

    // ---------------------------------------------------------------- Storage
    mapping(address => bool) public blocked;            // blacklisted / fraud / lost IDs
    mapping(address => bool) public approvedContract;   // only approved contracts may interconnect
    mapping(bytes32 => address) public systemWallet;    // protected system wallets (key => address)

    // System wallet keys (dashboard-friendly, config-based)
    bytes32 public constant DEV_WALLET = keccak256("DEV_WALLET");
    bytes32 public constant DAILY_POOL_WALLET = keccak256("DAILY_POOL_WALLET");
    bytes32 public constant WEEKLY_POOL_WALLET = keccak256("WEEKLY_POOL_WALLET");
    bytes32 public constant MONTHLY_POOL_WALLET = keccak256("MONTHLY_POOL_WALLET");
    bytes32 public constant LIQUIDITY_WALLET = keccak256("LIQUIDITY_WALLET");

    // ----------------------------------------------------------------- Events
    event UserBlocked(address indexed user, address indexed by);
    event UserUnblocked(address indexed user, address indexed by);
    event ContractApproval(address indexed target, bool approved, address indexed by);
    event SystemWalletUpdated(bytes32 indexed key, address indexed oldWallet, address indexed newWallet, address by);
    event SystemPaused(address indexed by);
    event SystemResumed(address indexed by);

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin); // ideally a multi-sig
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ------------------------------------------------------- Block / Unblock
    /// @notice Block a user. Blocked users cannot activate, stake, claim, earn rewards or sell.
    function blockUser(address user) external onlyRole(ADMIN_ROLE) {
        require(user != address(0), "user=0");
        require(!blocked[user], "already blocked");
        blocked[user] = true;
        emit UserBlocked(user, msg.sender);
    }

    /// @notice Unblock a previously blocked user (e.g. recovered/verified ID).
    function unblockUser(address user) external onlyRole(ADMIN_ROLE) {
        require(blocked[user], "not blocked");
        blocked[user] = false;
        emit UserUnblocked(user, msg.sender);
    }

    /// @notice Batch block/unblock for admin dashboard efficiency.
    function setBlockedBatch(address[] calldata users, bool blockedState) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            address u = users[i];
            if (u == address(0) || blocked[u] == blockedState) continue;
            blocked[u] = blockedState;
            if (blockedState) emit UserBlocked(u, msg.sender);
            else emit UserUnblocked(u, msg.sender);
        }
    }

    function isBlocked(address user) external view returns (bool) {
        return blocked[user];
    }

    // ------------------------------------------------ Approved contracts wiring
    /// @notice Approve/revoke a contract so the ecosystem contracts only interconnect with trusted code.
    function setApprovedContract(address target, bool approved) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(target != address(0), "target=0");
        approvedContract[target] = approved;
        emit ContractApproval(target, approved, msg.sender);
    }

    function isApprovedContract(address target) external view returns (bool) {
        return approvedContract[target];
    }

    // ------------------------------------------------------- System wallets
    /// @notice Update a protected system wallet (dev / pools / liquidity). High-risk => DEFAULT_ADMIN_ROLE (multi-sig).
    function setSystemWallet(bytes32 key, address wallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(wallet != address(0), "wallet=0");
        address old = systemWallet[key];
        systemWallet[key] = wallet;
        emit SystemWalletUpdated(key, old, wallet, msg.sender);
    }

    function getSystemWallet(bytes32 key) external view returns (address) {
        return systemWallet[key];
    }

    // ------------------------------------------------------- Emergency stop
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit SystemPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit SystemResumed(msg.sender);
    }

    // ------------------------------------------------------- Guard helpers
    /// @notice Reverts if the system is paused or the user is blocked. Called by other TITAN contracts.
    function whenActive(address user) external view {
        require(!paused(), "system paused");
        require(!blocked[user], "user blocked");
    }

    /// @notice Reverts if `caller` is not an approved ecosystem contract.
    function requireApproved(address caller) external view {
        require(approvedContract[caller], "not approved contract");
    }
}
