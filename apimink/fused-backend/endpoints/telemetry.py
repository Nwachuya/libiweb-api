from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict
import math
import collections

router = APIRouter(prefix="/telemetry", tags=["Cybersecurity"])

class LocationPoint(BaseModel):
    lat: float
    lon: float
    timestamp: str  # ISO-8601
    user_agent: str

class TelemetryRequest(BaseModel):
    points: List[LocationPoint]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_shannon_entropy(s: str) -> float:
    if not s: return 0.0
    probabilities = [n_x / len(s) for x, n_x in collections.Counter(s).items()]
    return -sum(p * math.log(p, 2) for p in probabilities)

@router.post("")
async def analyze_telemetry(request: TelemetryRequest):
    from datetime import datetime
    
    analysis = []
    impossible_travel = False
    
    # Sort points by timestamp
    points = sorted(request.points, key=lambda x: datetime.fromisoformat(x.timestamp))
    
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i+1]
        
        dist = haversine(p1.lat, p1.lon, p2.lat, p2.lon)
        time_delta = (datetime.fromisoformat(p2.timestamp) - datetime.fromisoformat(p1.timestamp)).total_seconds()
        
        # Speed in km/h
        speed = (dist / (time_delta / 3600)) if time_delta > 0 else 0
        
        # Entropy of User Agent
        entropy1 = calculate_shannon_entropy(p1.user_agent)
        entropy2 = calculate_shannon_entropy(p2.user_agent)
        
        is_suspicious = speed > 900 or abs(entropy1 - entropy2) > 1.0
        if is_suspicious: impossible_travel = True
        
        analysis.append({
            "segment": f"{i} to {i+1}",
            "distance_km": round(dist, 2),
            "required_speed_kmh": round(speed, 2),
            "is_suspicious": is_suspicious,
            "entropy": {"p1": round(entropy1, 2), "p2": round(entropy2, 2)}
        })
        
    return {
        "status": "FLAGGED" if impossible_travel else "SECURE",
        "impossible_travel": impossible_travel,
        "segments": analysis
    }
