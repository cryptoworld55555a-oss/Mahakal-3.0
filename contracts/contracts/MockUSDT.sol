// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT
 * @notice Testnet-only USDT with a public faucet, 18 decimals (matches BSC-USD).
 * @dev Use for BSC Testnet activation testing. Never deploy to mainnet.
 */
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    /// @notice Anyone can mint test USDT to themselves.
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
