from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Tuple, Optional

router = APIRouter(prefix="/pack", tags=["Bin Packing"])

class Item(BaseModel):
    id: str
    w: float
    h: float
    d: float

class Bin(BaseModel):
    w: float
    h: float
    d: float

class PackRequest(BaseModel):
    bin: Bin
    items: List[Item]

class PlacedItem(BaseModel):
    id: str
    x: float
    y: float
    z: float
    w: float
    h: float
    d: float

class PackResponse(BaseModel):
    fit: List[PlacedItem]
    not_fit: List[Item]

class Space:
    def __init__(self, x, y, z, w, h, d):
        self.x, self.y, self.z = x, y, z
        self.w, self.h, self.d = w, h, d
        self.volume = w * h * d

def get_rotations(w, h, d) -> List[Tuple[float, float, float]]:
    return list(set([
        (w, h, d), (w, d, h),
        (h, w, d), (h, d, w),
        (d, w, h), (d, h, w)
    ]))

@router.post("", response_model=PackResponse)
async def pack_items(request: PackRequest):
    # Sort items by volume (First-Fit Decreasing)
    items = sorted(request.items, key=lambda x: x.w * x.h * x.d, reverse=True)
    
    # Initialize bin space
    spaces = [Space(0, 0, 0, request.bin.w, request.bin.h, request.bin.d)]
    placed = []
    unplaced = []

    for item in items:
        best_space_idx = -1
        best_rotation = None
        
        # Try each rotation
        rotations = get_rotations(item.w, item.h, item.d)
        
        found = False
        for i, space in enumerate(spaces):
            for rw, rh, rd in rotations:
                if rw <= space.w and rh <= space.h and rd <= space.d:
                    best_space_idx = i
                    best_rotation = (rw, rh, rd)
                    found = True
                    break
            if found: break
        
        if found:
            space = spaces.pop(best_space_idx)
            rw, rh, rd = best_rotation
            
            placed.append(PlacedItem(
                id=item.id, x=space.x, y=space.y, z=space.z,
                w=rw, h=rh, d=rd
            ))
            
            # Guillotine Split into 3 new spaces: Right, Top, Front
            # Space 1: Right (remaining width)
            if space.w - rw > 0:
                spaces.append(Space(space.x + rw, space.y, space.z, space.w - rw, rh, rd))
            # Space 2: Top (remaining height)
            if space.h - rh > 0:
                spaces.append(Space(space.x, space.y + rh, space.z, space.w, space.h - rh, rd))
            # Space 3: Front (remaining depth)
            if space.d - rd > 0:
                spaces.append(Space(space.x, space.y, space.z + rd, space.w, space.h, space.d - rd))
            
            # Sort spaces by volume (smallest first to fill small gaps) or largest first?
            # Usually filling smaller spaces first is a heuristic, but here we just keep them.
            spaces.sort(key=lambda s: s.volume)
        else:
            unplaced.append(item)

    return {"fit": placed, "not_fit": unplaced}
