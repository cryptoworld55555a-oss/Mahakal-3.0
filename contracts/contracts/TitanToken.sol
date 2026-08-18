// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Titan (TTN)
 * @notice BEP-20 token. Fixed total supply of 200,000 TTN, no infinite mint.
 * @dev Full supply is minted once to the deployer/treasury at construction.
 */
contract TitanToken is ERC20Capped, Ownable {
    uint256 public constant MAX_SUPPLY = 200_000 ether; // 18 decimals

    constructor(address treasury)
        ERC20("Titan", "TTN")
        ERC20Capped(MAX_SUPPLY)
        Ownable(msg.sender)
    {
        _mint(treasury, MAX_SUPPLY);
    }
}
