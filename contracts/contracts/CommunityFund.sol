// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CommunityFund
 * @notice Module 1 skeleton: reserved ecosystem allocation & fund tracking.
 * @dev No owner "drain" backdoor — outflows are accounted and event-logged; Pausable.
 */
contract CommunityFund is ReentrancyGuard, Pausable, Ownable {
    uint256 public totalReceived;
    uint256 public totalAllocated = 0;
    address public protocol;

    event FundReceived(uint256 amount);
    event FundAllocated(address indexed to, uint256 amount, string reason);

    constructor() Ownable(msg.sender) {}

    function setProtocol(address _protocol) external onlyOwner {
        protocol = _protocol;
    }

    function record(uint256 amount) external whenNotPaused {
        require(msg.sender == protocol || msg.sender == owner(), "not authorized");
        totalReceived += amount;
        emit FundReceived(amount);
    }

    function balance() external view returns (uint256) {
        return totalReceived - totalAllocated;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
