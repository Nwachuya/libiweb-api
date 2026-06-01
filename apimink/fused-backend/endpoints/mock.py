from fastapi import APIRouter
from pydantic import BaseModel
import random
import re
from typing import Any, Dict, List, Optional

router = APIRouter(prefix="/mock", tags=["Mock"])

class MockRequest(BaseModel):
    rows: int = 10
    seed: Optional[int] = None
    schema_definition: Dict[str, str]

class MockResponse(BaseModel):
    data: List[Dict[str, Any]]

class ASTEvaluator:
    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            random.seed(seed)
        self.row_index = 0

    def evaluate(self, expression: str, row_context: Dict[str, Any]) -> Any:
        # 1. increment
        if expression == "increment":
            return self.row_index + 1
        
        # 2. random_int(min, max)
        match_int = re.match(r"random_int\((\d+),\s*(\d+)\)", expression)
        if match_int:
            return random.randint(int(match_int.group(1)), int(match_int.group(2)))

        # 3. random_name
        if expression == "random_name":
            names = ["Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "George", "Hannah"]
            return random.choice(names)

        # 4. if {condition} then {value1} else {value2}
        if expression.startswith("if "):
            match_if = re.match(r"if\s+(.+)\s+then\s+(.+)\s+else\s+(.+)", expression)
            if match_if:
                condition_expr = match_if.group(1)
                then_val = match_if.group(2).strip("'\" ")
                else_val = match_if.group(3).strip("'\" ")
                
                if self.eval_condition(condition_expr, row_context):
                    return self.cast_value(then_val)
                else:
                    return self.cast_value(else_val)

        return expression

    def eval_condition(self, condition: str, row_context: Dict[str, Any]) -> bool:
        # Support basic comparison: {key} > {val}, {key} == {val}
        match = re.match(r"(\w+)\s*(>|<|==|!=)\s*(.+)", condition)
        if match:
            key, op, val = match.groups()
            if key in row_context:
                current_val = row_context[key]
                target_val = int(val) if val.strip().isdigit() else val.strip("'\" ")
                
                if op == ">": return current_val > target_val
                if op == "<": return current_val < target_val
                if op == "==": return current_val == target_val
                if op == "!=": return current_val != target_val
        return False

    def cast_value(self, val: str) -> Any:
        if val.isdigit():
            return int(val)
        return val

@router.post("", response_model=MockResponse)
async def generate_mock_data(request: MockRequest):
    evaluator = ASTEvaluator(seed=request.seed)
    results = []

    for i in range(request.rows):
        evaluator.row_index = i
        row_data = {}
        # Order matters: fields are evaluated sequentially to allow stateful dependencies
        for key, expr in request.schema_definition.items():
            row_data[key] = evaluator.evaluate(expr, row_data)
        results.append(row_data)

    return {"data": results}
