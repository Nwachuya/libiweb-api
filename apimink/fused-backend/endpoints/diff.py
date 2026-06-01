from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, List, Dict, Optional
import json
import jellyfish

router = APIRouter(prefix="/diff", tags=["Semantic Reconciliation"])

class DiffRequest(BaseModel):
    source: Dict[str, Any]
    target: Dict[str, Any]
    similarity_threshold: float = 0.8  # For key renaming detection

class PatchOperation(BaseModel):
    op: str
    path: str
    value: Optional[Any] = None
    from_path: Optional[str] = None  # Use from_path for 'move' and 'copy'

class DiffResponse(BaseModel):
    patch: List[Dict[str, Any]]

def get_structural_hash(obj: Any) -> str:
    """Generates a stable string representation for sorting."""
    if isinstance(obj, dict):
        # Sort keys to ensure stability
        items = sorted([(k, get_structural_hash(v)) for k, v in obj.items()])
        return "{" + ",".join([f"{k}:{v}" for k, v in items]) + "}"
    elif isinstance(obj, list):
        items = sorted([get_structural_hash(x) for x in obj])
        return "[" + ",".join(items) + "]"
    else:
        return str(obj)

def normalize_json(obj: Any) -> Any:
    """Recursively sorts arrays by structural hash to ignore ordering."""
    if isinstance(obj, dict):
        return {k: normalize_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return sorted([normalize_json(x) for x in obj], key=lambda x: get_structural_hash(x))
    else:
        return obj

def generate_patch(src: Any, tgt: Any, path: str = "") -> List[Dict[str, Any]]:
    patch = []
    
    if src == tgt:
        return []

    if type(src) != type(tgt):
        patch.append({"op": "replace", "path": path or "/", "value": tgt})
        return patch

    if isinstance(src, dict):
        src_keys = set(src.keys())
        tgt_keys = set(tgt.keys())

        # Removed keys
        for k in src_keys - tgt_keys:
            patch.append({"op": "remove", "path": f"{path}/{k}"})

        # Added keys
        for k in tgt_keys - src_keys:
            patch.append({"op": "add", "path": f"{path}/{k}", "value": tgt[k]})

        # Common keys
        for k in src_keys & tgt_keys:
            patch.extend(generate_patch(src[k], tgt[k], f"{path}/{k}"))

    elif isinstance(src, list):
        # Since we normalize/sort arrays, we can do a simple index comparison
        # Or more complex LCS. For simplicity and following "semantic" rules:
        # If lengths differ or contents differ, replace the whole array 
        # (RFC 6902 allows index-based patch but order is semantic here)
        # However, the user asked for "semantic reconciliation" ignoring order.
        # So we compare normalized versions.
        if normalize_json(src) != normalize_json(tgt):
            patch.append({"op": "replace", "path": path or "/", "value": tgt})
            
    else:
        patch.append({"op": "replace", "path": path or "/", "value": tgt})

    return patch

@router.post("", response_model=DiffResponse)
async def semantic_diff(request: DiffRequest):
    # Step 1: Normalize (sort arrays) to focus on data, not order
    # Note: We diff original objects but use normalization to decide if a change is needed
    # Actually, the user wants to ignore ordering differences.
    norm_src = normalize_json(request.source)
    norm_tgt = normalize_json(request.target)
    
    # Step 2: Generate RFC 6902 Patch
    patch = generate_patch(norm_src, norm_tgt)
    
    return {"patch": patch}
