from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from scipy.signal import savgol_filter
from datetime import datetime, timedelta

router = APIRouter(prefix="/series", tags=["IoT / Monitoring"])

class DataPoint(BaseModel):
    timestamp: str  # ISO-8601
    value: float

class SeriesRequest(BaseModel):
    data: List[DataPoint]
    interval_seconds: int = 60
    window_size: int = 5  # For Savitzky-Golay
    polyorder: int = 2     # For Savitzky-Golay

@router.post("")
async def interpolate_series(request: SeriesRequest):
    if not request.data:
        return {"processed": [], "anomalies": []}

    # 1. Parse and sort data
    pts = sorted(request.data, key=lambda x: datetime.fromisoformat(x.timestamp))
    start_time = datetime.fromisoformat(pts[0].timestamp)
    end_time = datetime.fromisoformat(pts[-1].timestamp)
    
    # Create uniform timeline
    current = start_time
    timeline = []
    while current <= end_time:
        timeline.append(current)
        current += timedelta(seconds=request.interval_seconds)

    # 2. Resample and Linear Interpolation
    raw_times = [datetime.fromisoformat(p.timestamp).timestamp() for p in pts]
    raw_values = [p.value for p in pts]
    
    uniform_times = [t.timestamp() for t in timeline]
    # np.interp performs linear interpolation
    interpolated_values = np.interp(uniform_times, raw_times, raw_values)

    # 3. Savitzky-Golay Smoothing
    # Window size must be odd and less than the number of points
    w = request.window_size
    if w >= len(interpolated_values):
        w = len(interpolated_values) if len(interpolated_values) % 2 != 0 else len(interpolated_values) - 1
    if w < 3: w = 3 # Minimum window
    
    if len(interpolated_values) >= w:
        smoothed_values = savgol_filter(interpolated_values, w, request.polyorder)
    else:
        smoothed_values = interpolated_values

    # 4. Anomaly Detection (Z-Score > 3)
    mean = np.mean(smoothed_values)
    std = np.std(smoothed_values)
    
    processed = []
    anomalies = []
    
    for i, t in enumerate(timeline):
        val = float(smoothed_values[i])
        z_score = abs(val - mean) / std if std > 0 else 0
        
        point_data = {
            "timestamp": t.isoformat(),
            "value": round(val, 4),
            "z_score": round(z_score, 2)
        }
        
        processed.append(point_data)
        if z_score > 3.0:
            anomalies.append(point_data)

    return {
        "summary": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
            "count": len(processed),
            "mean": round(float(mean), 4),
            "std": round(float(std), 4)
        },
        "processed": processed,
        "anomalies": anomalies
    }
