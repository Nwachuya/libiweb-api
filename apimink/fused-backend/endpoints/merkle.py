import hashlib
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/merkle", tags=["Web3 / Auditing"])

class MerkleRequest(BaseModel):
    data_blocks: List[str]

def hash_pair(left: str, right: str) -> str:
    combined = left + right
    return hashlib.sha256(combined.encode()).hexdigest()

@router.post("/root")
async def calculate_merkle_root(request: MerkleRequest):
    if not request.data_blocks:
        return {"error": "No data blocks provided."}
    
    # 1. Initial Leaf Hashes
    current_layer = [hashlib.sha256(b.encode()).hexdigest() for b in request.data_blocks]
    layers = [current_layer]
    
    # 2. Build Tree
    while len(current_layer) > 1:
        next_layer = []
        for i in range(0, len(current_layer), 2):
            left = current_layer[i]
            # If odd number of nodes, pair last one with itself
            right = current_layer[i+1] if i+1 < len(current_layer) else left
            next_layer.append(hash_pair(left, right))
        current_layer = next_layer
        layers.append(current_layer)
        
    return {
        "merkle_root": current_layer[0],
        "leaf_count": len(request.data_blocks),
        "tree_depth": len(layers),
        "algorithm": "Merkle Tree (SHA-256 Recursive Hashing)"
    }

class ProofRequest(BaseModel):
    data_blocks: List[str]
    target_index: int

@router.post("/proof")
async def generate_proof(request: ProofRequest):
    if request.target_index >= len(request.data_blocks):
        return {"error": "Index out of range."}
        
    current_layer = [hashlib.sha256(b.encode()).hexdigest() for b in request.data_blocks]
    proof = []
    idx = request.target_index
    
    while len(current_layer) > 1:
        # Determine sibling index
        sibling_idx = idx + 1 if idx % 2 == 0 else idx - 1
        
        # Add sibling to proof (or self if at edge)
        if sibling_idx < len(current_layer):
            proof.append({
                "position": "right" if idx % 2 == 0 else "left",
                "hash": current_layer[sibling_idx]
            })
        else:
            # Handle edge case for odd number of nodes (duplicate hash)
            proof.append({
                "position": "right",
                "hash": current_layer[idx]
            })
            
        # Move to next layer
        next_layer = []
        for i in range(0, len(current_layer), 2):
            left = current_layer[i]
            right = current_layer[i+1] if i+1 < len(current_layer) else left
            next_layer.append(hash_pair(left, right))
            
        current_layer = next_layer
        idx //= 2
        
    return {
        "target_data": request.data_blocks[request.target_index],
        "merkle_root": current_layer[0],
        "proof_path": proof,
        "note": "Automates Zero-Knowledge verification by providing the sibling path."
    }

class VerifyRequest(BaseModel):
    root: str
    target_data: str
    proof_path: List[dict]

@router.post("/verify")
async def verify_merkle_proof(request: VerifyRequest):
    # Reconstruct root from target data and proof path
    current_hash = hashlib.sha256(request.target_data.encode()).hexdigest()
    
    for sibling in request.proof_path:
        if sibling["position"] == "left":
            current_hash = hash_pair(sibling["hash"], current_hash)
        else:
            current_hash = hash_pair(current_hash, sibling["hash"])
            
    is_valid = (current_hash == request.root)
    
    return {
        "is_valid": is_valid,
        "reconstructed_root": current_hash,
        "provided_root": request.root,
        "audit": "Successfully proved inclusion." if is_valid else "Verification failed - data or proof tampered."
    }
