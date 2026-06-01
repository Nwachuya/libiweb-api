from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/proration", tags=["B2B SaaS / Billing"])

class Tier(BaseModel):
    min_qty: float
    max_qty: Optional[float] = None
    unit_price: float

class ProrationRequest(BaseModel):
    cycle_start: str
    cycle_end: str
    change_timestamp: str
    usage: float = 0.0
    seats: int = 1
    tax_rate: float = 0.0  # e.g., 0.20 for 20%
    old_tiers: List[Tier]
    new_tiers: List[Tier]

def calculate_tiered_cost(qty: float, tiers: List[Tier]) -> float:
    cost = 0.0
    remaining_qty = qty
    sorted_tiers = sorted(tiers, key=lambda x: x.min_qty)
    
    for tier in sorted_tiers:
        if remaining_qty <= 0:
            break
        
        limit = (tier.max_qty - tier.min_qty) if tier.max_qty is not None else float('inf')
        taxable_qty = min(remaining_qty, limit)
        
        cost += taxable_qty * tier.unit_price
        remaining_qty -= taxable_qty
        
    return cost

@router.post("")
async def calculate_proration(request: ProrationRequest):
    # 1. Time Ratios
    start = datetime.fromisoformat(request.cycle_start)
    end = datetime.fromisoformat(request.cycle_end)
    change = datetime.fromisoformat(request.change_timestamp)
    
    total_sec = (end - start).total_seconds()
    if total_sec <= 0:
        return {"error": "Invalid cycle duration"}
        
    elapsed_ratio = max(0.0, min(1.0, (change - start).total_seconds() / total_sec))
    remaining_ratio = 1.0 - elapsed_ratio
    
    # 2. Base Calculation (Usage or Seats)
    # If seats > 1, we treat the tiered price as "price per seat"
    # and calculate cost based on total seats.
    
    # Calculate costs for both periods
    # We apply the full seat count/usage to tiers, then prorate by time.
    # Note: In most SaaS, you pay for the whole month's usage but at different rates.
    # If it's seats, it's (Seats * TieredPrice) * TimeRatio.
    
    def get_period_cost(tiers, ratio):
        # If both usage and seats are provided, we multiply them? 
        # Usually it's either usage-based OR seat-based. 
        # Here we assume (Price(usage or seats) * ratio)
        base_qty = request.usage if request.usage > 0 else request.seats
        unit_cost = calculate_tiered_cost(base_qty, tiers)
        return unit_cost * ratio

    old_subtotal = get_period_cost(request.old_tiers, elapsed_ratio)
    new_subtotal = get_period_cost(request.new_tiers, remaining_ratio)
    
    subtotal = old_subtotal + new_subtotal
    tax_amount = subtotal * request.tax_rate
    total = subtotal + tax_amount
    
    return {
        "metadata": {
            "billing_cycle": "annual" if total_sec > 25000000 else "monthly",
            "days_in_cycle": round(total_sec / 86400, 2),
            "ratios": {"old": round(elapsed_ratio, 4), "new": round(remaining_ratio, 4)}
        },
        "calculation": {
            "old_period_prorated": round(old_subtotal, 2),
            "new_period_prorated": round(new_subtotal, 2),
            "subtotal": round(subtotal, 2),
            "tax_rate": f"{request.tax_rate * 100}%",
            "tax_amount": round(tax_amount, 2),
            "total_due": round(total, 2)
        }
    }
