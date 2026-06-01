import math
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter(prefix="/spatial", tags=["Logistics / Drones"])

class Point(BaseModel):
    lat: float
    lng: float

class SpatialRequest(BaseModel):
    point: Point
    polygon: List[Point]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def point_to_segment_dist(p, s1, s2):
    # Returns minimum distance between point p and segment s1-s2 (in meters, approx)
    # Using equirectangular approximation for small distances
    lat, lng = p
    lat1, lng1 = s1
    lat2, lng2 = s2
    
    # Haversine distance is better for accuracy, but for 'nearest point on segment'
    # we use a local flat projection
    def to_cartesian(lt, ln):
        return (ln * math.cos(math.radians(lt)), lt)
    
    px, py = to_cartesian(lat, lng)
    x1, y1 = to_cartesian(lat1, lng1)
    x2, y2 = to_cartesian(lat2, lng2)
    
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return haversine(lat, lng, lat1, lng1)
    
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    
    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    
    # Project back to lat/lng roughly or just use haversine on the closest point
    # Since we are doing a local projection, we can just calculate distance here
    # and convert back to meters. 1 degree lat is approx 111km.
    dist_deg = math.sqrt((px - closest_x)**2 + (py - closest_y)**2)
    return dist_deg * 111320 # Approx meters per degree

@router.post("")
async def geofence_check(request: SpatialRequest):
    x, y = request.point.lng, request.point.lat
    poly = [(p.lat, p.lng) for p in request.polygon]
    n = len(poly)
    
    # 1. Ray-Casting Algorithm
    inside = False
    p1lat, p1lng = poly[0]
    for i in range(n + 1):
        p2lat, p2lng = poly[i % n]
        if x > min(p1lng, p2lng):
            if x <= max(p1lng, p2lng):
                if y <= max(p1lat, p2lat):
                    if p1lng != p2lng:
                        yinters = (x - p1lng) * (p2lat - p1lat) / (p2lng - p1lng) + p1lat
                    if p1lat == p2lat or y <= yinters:
                        inside = not inside
        p1lat, p1lng = p2lat, p2lng

    # 2. Distance to nearest boundary
    min_dist = float('inf')
    for i in range(n):
        s1 = poly[i]
        s2 = poly[(i + 1) % n]
        d = point_to_segment_dist((y, x), s1, s2)
        if d < min_dist:
            min_dist = d

    return {
        "is_inside": inside,
        "distance_to_boundary_m": round(min_dist, 2),
        "algorithm": "Ray-Casting (Jordan Curve Theorem)",
        "geometry": {
            "point": {"lat": y, "lng": x},
            "polygon_vertices": n
        }
    }
