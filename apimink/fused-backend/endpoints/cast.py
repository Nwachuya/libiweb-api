from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, List, Optional, Tuple, Union
import jellyfish
import re

router = APIRouter(prefix="/cast", tags=["Data Engineering"])

class CastRequest(BaseModel):
    payload: Union[List[Dict[str, Any]], Dict[str, Any]]
    schema_definition: Dict[str, str]  # e.g., {"user_id": "int", "profile.name": "str"}
    fuzzy_threshold: float = 0.8

class CastResponse(BaseModel):
    healed: Union[List[Dict[str, Any]], Dict[str, Any]]
    remaps: Dict[str, str]  # original_key -> healed_key

def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def coerce_type(value: Any, target_type: str) -> Any:
    if target_type == "int":
        try: return int(float(value))
        except: return 0
    elif target_type == "float":
        try: return float(value)
        except: return 0.0
    elif target_type == "str":
        return str(value)
    elif target_type == "bool":
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes", "y", "t")
        return bool(value)
    return value

def normalize_text(t: str) -> str:
    return re.sub(r'[^a-z0-9]', '', t.lower())

def get_tokens(t: str) -> set:
    return set(re.split(r'[^a-z0-9]', t.lower()))

# High-authority semantic aliases for common enterprise drifts
SEMANTIC_ALIASES = {
    "age": {"yrs", "years", "dob", "birth"},
    "user_id": {"uid", "pk", "id", "userid"},
    "location": {"loc", "city", "address", "geo"}
}

def process_single_object(payload: Dict[str, Any], schema: Dict[str, str], threshold: float) -> Tuple[Dict[str, Any], Dict[str, str]]:
    flat_payload = flatten_dict(payload)
    healed = {}
    remaps = {}

    for target_key, target_type in schema.items():
        best_match = None
        best_score = 0
        
        t_short = target_key.split(".")[-1].lower()
        t_norm = normalize_text(t_short)
        t_tokens = get_tokens(target_key.split(".")[-1])
        t_aliases = SEMANTIC_ALIASES.get(target_key, set())

        for payload_key, val in flat_payload.items():
            p_orig = payload_key.split(".")[-1].lower()
            p_norm = normalize_text(p_orig)
            p_tokens = get_tokens(p_orig)
            
            score = 0
            # 1. Exact or normalized match
            if p_norm == t_norm or p_orig == t_short:
                score = 1.0
            # 2. Token intersection (e.g., 'years_old' vs 'age' or 'user_id' vs 'id_user')
            elif t_tokens & p_tokens:
                score = 0.9
            # 3. Semantic Alias match
            elif p_tokens & t_aliases:
                score = 0.85
            # 4. Substring match
            elif p_norm in t_norm or t_norm in p_norm:
                score = 0.8
            # 5. Fuzzy match
            else:
                score = jellyfish.jaro_winkler_similarity(p_norm, t_norm)
            
            if score > best_score and score >= threshold:
                best_score = score
                best_match = payload_key

        if best_match:
            raw_value = flat_payload[best_match]
            coerced_value = coerce_type(raw_value, target_type)
            
            parts = target_key.split(".")
            curr = healed
            for part in parts[:-1]:
                if part not in curr: curr[part] = {}
                curr = curr[part]
            curr[parts[-1]] = coerced_value
            
            if best_match != target_key:
                remaps[best_match] = target_key
    
    return healed, remaps

@router.post("", response_model=CastResponse)
async def schema_cast(request: CastRequest):
    if isinstance(request.payload, list):
        all_healed = []
        all_remaps = {}
        for item in request.payload:
            if isinstance(item, dict):
                h, r = process_single_object(item, request.schema_definition, request.fuzzy_threshold)
                all_healed.append(h)
                all_remaps.update(r)
        return {"healed": all_healed, "remaps": all_remaps}
    
    elif isinstance(request.payload, dict):
        h, r = process_single_object(request.payload, request.schema_definition, request.fuzzy_threshold)
        return {"healed": h, "remaps": r}
    
    return {"healed": {}, "remaps": {}}
