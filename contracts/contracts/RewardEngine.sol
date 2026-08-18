// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/**
 * @title RewardEngine
 * @notice Module 1 skeleton: backend-signed + contract-verified claim payouts.
 * @dev On claim, buys TTN on PancakeSwap (config-driven router/path) with
 *      slippage protection + max cap, then sends TTN to the user. Anti-replay via nonce.
 */
contract RewardEngine is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public immutable usdt;
    IERC20 public immutable ttn;
    IPancakeRouter public router; // config-driven; set on launch
    address public signer;         // backend authorization signer

    uint256 public maxClaimPerTx;  // MEV / abuse cap
    mapping(uint256 => bool) public usedNonce;

    event ClaimPaid(address indexed user, uint256 ttnOut, uint256 nonce);
    event RouterUpdated(address router);
    event SignerUpdated(address signer);

    constructor(address _usdt, address _ttn, address _signer) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        ttn = IERC20(_ttn);
        signer = _signer;
    }

    function setRouter(address _router) external onlyOwner {
        router = IPancakeRouter(_router);
        emit RouterUpdated(_router);
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    function setMaxClaimPerTx(uint256 _max) external onlyOwner {
        maxClaimPerTx = _max;
    }

    /**
     * @notice Claim TTN. Backend signs (user, usdtIn, minTtnOut, nonce, deadline).
     * @dev Contract verifies the signature, then buys TTN via PancakeSwap and forwards it.
     */
    function claim(
        uint256 usdtIn,
        uint256 minTtnOut,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(block.timestamp <= deadline, "expired");
        require(!usedNonce[nonce], "nonce used");
        require(maxClaimPerTx == 0 || usdtIn <= maxClaimPerTx, "over cap");

        bytes32 digest = keccak256(
            abi.encodePacked(msg.sender, usdtIn, minTtnOut, nonce, deadline, address(this), block.chainid)
        );
        address recovered = MessageHashUtils.toEthSignedMessageHash(digest).recover(signature);
        require(recovered == signer, "bad signature");

        usedNonce[nonce] = true;

        // Buy TTN on PancakeSwap with slippage protection (minTtnOut) and forward to user.
        address[] memory path = new address[](2);
        path[0] = address(usdt);
        path[1] = address(ttn);
        usdt.forceApprove(address(router), usdtIn);
        uint256[] memory out = router.swapExactTokensForTokens(
            usdtIn, minTtnOut, path, msg.sender, deadline
        );

        emit ClaimPaid(msg.sender, out[out.length - 1], nonce);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
