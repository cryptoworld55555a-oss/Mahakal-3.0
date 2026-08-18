// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PoolManager
 * @notice Module 1 skeleton: daily / weekly / monthly pool balances & distribution accounting.
 * @dev Distribution/eligibility logic arrives in Module 3.
 */
contract PoolManager is ReentrancyGuard, Pausable, Ownable {
    enum PoolType { Daily, Weekly, Monthly }

    mapping(PoolType => uint256) public poolBalance;
    address public protocol; // MainProtocol authorized to fund pools

    event PoolFunded(PoolType indexed pool, uint256 amount);
    event PoolDistributed(PoolType indexed pool, uint256 amount);

    constructor() Ownable(msg.sender) {}

    modifier onlyProtocol() {
        require(msg.sender == protocol || msg.sender == owner(), "not authorized");
        _;
    }

    function setProtocol(address _protocol) external onlyOwner {
        protocol = _protocol;
    }

    function fund(PoolType pool, uint256 amount) external onlyProtocol whenNotPaused {
        poolBalance[pool] += amount;
        emit PoolFunded(pool, amount);
    }

    function balances() external view returns (uint256 daily, uint256 weekly, uint256 monthly) {
        return (poolBalance[PoolType.Daily], poolBalance[PoolType.Weekly], poolBalance[PoolType.Monthly]);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
