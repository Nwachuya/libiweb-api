import json
import re
import ast
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, Optional

router = APIRouter(prefix="/enforcer", tags=["AI / DevTools"])

class EnforceRequest(BaseModel):
    raw_output: str
    target_schema: Dict[str, str]  # e.g. {"age": "int", "active": "bool"}

def clean_llm_string(raw: str) -> str:
    # 1. Strip Markdown code blocks
    raw = re.sub(r'```(?:json)?\s*([\s\S]*?)```', r'\1', raw).strip()
    # 2. Fix trailing commas in arrays/objects
    raw = re.sub(r',\s*([\]}])', r'\1', raw)
    return raw

def coerce_value(val: Any, target_type: str):
    try:
        if target_type == "int":
            return int(str(val).replace(",", ""))
        if target_type == "float":
            return float(str(val).replace(",", ""))
        if target_type == "bool":
            return str(val).lower() in ("true", "1", "yes", "on")
        if target_type == "str":
            return str(val)
        return val
    except:
        return None

@router.post("")
async def enforce_structure(request: EnforceRequest):
    cleaned = clean_llm_string(request.raw_output)
    
    # Attempt parsing via ast.literal_eval first (handles single quotes better than json.loads)
    try:
        parsed = ast.literal_eval(cleaned)
    except:
        try:
            parsed = json.loads(cleaned)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to parse structure even after cleaning: {str(e)}",
                "partially_cleaned": cleaned
            }

    # Type Coercion
    enforced = {}
    audit_log = []
    
    for key, target_type in request.target_schema.items():
        if key in parsed:
            original_val = parsed[key]
            coerced_val = coerce_value(original_val, target_type)
            enforced[key] = coerced_val
            if type(original_val).__name__ != target_type:
                audit_log.append(f"Coerced '{key}' from {type(original_val).__name__} to {target_type}")
        else:
            enforced[key] = None
            audit_log.append(f"Missing key '{key}' - set to null")

    return {
        "success": True,
        "enforced_object": enforced,
        "audit": audit_log,
        "original_had_markdown": "```" in request.raw_output
    }
