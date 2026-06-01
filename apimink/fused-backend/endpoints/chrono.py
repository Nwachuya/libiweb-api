from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import zoneinfo
from typing import List, Optional

router = APIRouter(prefix="/chrono", tags=["Chrono"])

class Interval(BaseModel):
    start: str
    end: str

class Participant(BaseModel):
    name: str
    timezone: str
    intervals: List[Interval]

class IntersectionRequest(BaseModel):
    participants: List[Participant]

class IntersectionResponse(BaseModel):
    intersections: List[Interval]

def to_utc_epoch(dt_str: str, tz_name: str) -> int:
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
        dt = datetime.fromisoformat(dt_str).replace(tzinfo=tz)
        return int(dt.timestamp())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date or timezone: {e}")

@router.post("", response_model=IntersectionResponse)
async def find_intersections(request: IntersectionRequest):
    if not request.participants:
        return {"intersections": []}

    all_events = []
    num_participants = len(request.participants)

    for participant in request.participants:
        for interval in participant.intervals:
            start_utc = to_utc_epoch(interval.start, participant.timezone)
            end_utc = to_utc_epoch(interval.end, participant.timezone)
            all_events.append((start_utc, 1))
            all_events.append((end_utc, -1))

    all_events.sort(key=lambda x: (x[0], -x[1]))

    intersections = []
    counter = 0
    current_start = None

    for timestamp, event_type in all_events:
        prev_counter = counter
        counter += event_type

        if counter == num_participants and prev_counter < num_participants:
            current_start = timestamp
        elif prev_counter == num_participants and counter < num_participants:
            if current_start is not None:
                intersections.append(Interval(
                    start=datetime.fromtimestamp(current_start, tz=timezone.utc).isoformat(),
                    end=datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
                ))
                current_start = None

    return {"intersections": intersections}
