from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, List, Union

router = APIRouter(prefix="/policy", tags=["Cybersecurity"])

class PolicyRequest(BaseModel):
    rules: Dict[str, Any]
    attributes: Dict[str, Any]

class PolicyResponse(BaseModel):
    allowed: bool

def evaluate(rule: Any, attrs: Dict[str, Any]) -> Any:
    if not isinstance(rule, dict):
        return rule

    operator = list(rule.keys())[0]
    values = rule[operator]

    if not isinstance(values, list):
        values = [values]

    if operator == "var":
        return attrs.get(values[0])

    eval_values = [evaluate(v, attrs) for v in values]

    if operator == "and":
        return all(eval_values)
    elif operator == "or":
        return any(eval_values)
    elif operator == "not":
        return not eval_values[0]
    elif operator == "==":
        return eval_values[0] == eval_values[1]
    elif operator == "!=":
        return eval_values[0] != eval_values[1]
    elif operator == ">":
        return eval_values[0] > eval_values[1]
    elif operator == ">=":
        return eval_values[0] >= eval_values[1]
    elif operator == "<":
        return eval_values[0] < eval_values[1]
    elif operator == "<=":
        return eval_values[0] <= eval_values[1]
    elif operator == "in":
        return eval_values[0] in eval_values[1]

    return False

@router.post("", response_model=PolicyResponse)
async def evaluate_policy(request: PolicyRequest):
    result = evaluate(request.rules, request.attributes)
    return {"allowed": bool(result)}
