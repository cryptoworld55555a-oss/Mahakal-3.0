"""OpenZeppelin StandardMerkleTree — Python port matching @openzeppelin/merkle-tree.

Backend uses this to turn reward-engine output into a Merkle root (posted on-chain by
owner/multisig) plus per-user proofs (used by users to claim their own leaf). The backend
holds NO key that can move funds — it only publishes a root.

Leaf = keccak256(keccak256(abi.encode(types, values))), sorted-pair (commutative) hashing.
Each leaf carries a reward CATEGORY so every claim type shows a distinct named function on
BscScan (0=ROI, 1=Level, 2=Daily, 3=Weekly, 4=Monthly).
"""
from typing import List, Tuple
from eth_abi import encode as abi_encode
from eth_utils import keccak, to_checksum_address

LEAF_TYPES = ["address", "uint8", "uint256"]  # (user, category, cumulativeUsdWei)


def leaf_hash(address: str, category: int, amount_wei: int) -> bytes:
    encoded = abi_encode(LEAF_TYPES, [to_checksum_address(address), int(category), int(amount_wei)])
    return keccak(keccak(encoded))


def _hash_pair(a: bytes, b: bytes) -> bytes:
    lo, hi = (a, b) if a <= b else (b, a)
    return keccak(lo + hi)


def _build_tree(leaves: List[bytes]) -> List[bytes]:
    n = len(leaves)
    tree = [b"\x00" * 32] * (2 * n - 1)
    for i, leaf in enumerate(leaves):
        tree[len(tree) - 1 - i] = leaf
    for i in range(len(tree) - 1 - n, -1, -1):
        tree[i] = _hash_pair(tree[2 * i + 1], tree[2 * i + 2])
    return tree


def build(values: List[Tuple[str, int, int]]) -> dict:
    """values: list of (address, category, cumulative_usd_wei).
    Returns {root, proofs: [{address, category, amount_wei, proof:[hex]}]}"""
    if not values:
        return {"root": "0x" + "00" * 32, "proofs": []}
    hashed = [(leaf_hash(a, cat, amt), (a, cat, amt)) for (a, cat, amt) in values]
    hashed.sort(key=lambda x: x[0])  # ascending, matches OZ compareBytes
    leaves = [h for (h, _) in hashed]
    tree = _build_tree(leaves)

    proofs = []
    for sorted_idx, (leaf, (addr, cat, amt)) in enumerate(hashed):
        tree_index = len(tree) - 1 - sorted_idx
        proof = []
        idx = tree_index
        while idx > 0:
            sibling = idx - 1 if idx % 2 == 0 else idx + 1
            proof.append("0x" + tree[sibling].hex())
            idx = (idx - 1) // 2
        proofs.append({
            "address": to_checksum_address(addr),
            "category": int(cat),
            "amount_wei": str(int(amt)),
            "proof": proof,
        })
    return {"root": "0x" + tree[0].hex(), "proofs": proofs}
