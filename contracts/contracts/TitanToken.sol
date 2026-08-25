// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Titan (TTN)
 * @notice BEP-20 token. Fixed total supply of 200,000 TTN, no infinite mint.
 * @dev Full supply is minted ONCE, at construction, DIRECTLY to `treasury` (the TitanProtocol
 *      contract on mainnet) — so NO personal wallet ever holds the supply and BscScan shows the
 *      contract as holder #1 from the very first transaction (no wallet->contract transfer).
 *      TRANSFER-RESTRICTED: a normal user CANNOT send TTN to arbitrary wallets.
 *      A transfer is only allowed when `from` OR `to` is whitelisted (the TitanProtocol
 *      contract, treasury/owner for setup, etc.). This means:
 *        - Protocol -> user (reward/claim delivery)  ✅
 *        - user -> Protocol (sell)                    ✅
 *      but user -> random wallet and pool -> outsider are BLOCKED (no third-party trading).
 */
contract TitanToken is ERC20Capped, Ownable {
    uint256 public constant MAX_SUPPLY = 200_000 ether; // 18 decimals

    mapping(address => bool) public whitelisted; // may freely send/receive TTN

    event Whitelisted(address indexed account, bool allowed);

    constructor(address treasury)
        ERC20("Titan", "TTN")
        ERC20Capped(MAX_SUPPLY)
        Ownable(msg.sender)
    {
        whitelisted[treasury] = true;
        whitelisted[msg.sender] = true;
        _mint(treasury, MAX_SUPPLY);
    }

    /// @notice Whitelist/unwhitelist an address (e.g. TitanProtocol). Only owner.
    function setWhitelisted(address account, bool allowed) external onlyOwner {
        whitelisted[account] = allowed;
        emit Whitelisted(account, allowed);
    }

    /// @dev Enforce transfer restriction. Mint/burn (from/to == 0) always allowed.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(whitelisted[from] || whitelisted[to], "TTN: transfers restricted");
        }
        super._update(from, to, value);
    }
}
