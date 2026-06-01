import math
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Tuple

router = APIRouter(prefix="/gcode", tags=["Manufacturing"])

class ToolpathPoint(BaseModel):
    x: float
    y: float
    z: float

class GCodeRequest(BaseModel):
    points: List[ToolpathPoint]

def calculate_distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2)

def total_distance(path):
    dist = 0
    for i in range(len(path) - 1):
        dist += calculate_distance(path[i], path[i+1])
    return dist

def optimize_2opt(path):
    # Standard 2-opt heuristic for TSP
    best_path = path[:]
    best_dist = total_distance(best_path)
    improved = True
    
    while improved:
        improved = False
        for i in range(1, len(best_path) - 2):
            for j in range(i + 1, len(best_path)):
                if j - i == 1: continue # adjacent edges
                
                # Try swapping
                new_path = best_path[:]
                new_path[i:j] = best_path[j-1:i-1:-1] # Reverse the segment
                
                new_dist = total_distance(new_path)
                if new_dist < best_dist:
                    best_path = new_path
                    best_dist = new_dist
                    improved = True
        
    return best_path, best_dist

@router.post("")
async def optimize_toolpath(request: GCodeRequest):
    if len(request.points) < 4:
        return {"error": "Need at least 4 points to perform 2-opt optimization."}
        
    original_dist = total_distance(request.points)
    optimized_path, optimized_dist = optimize_2opt(request.points)
    
    return {
        "original_total_distance": round(original_dist, 2),
        "optimized_total_distance": round(optimized_dist, 2),
        "efficiency_gain": f"{round((1 - optimized_dist/original_dist) * 100, 2)}%",
        "optimized_points": optimized_path,
        "algorithm": "2-opt TSP Heuristic (Iterative Path Uncrossing)"
    }
