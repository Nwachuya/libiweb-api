from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Literal, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/tax", tags=["FinTech"])

class Transaction(BaseModel):
    type: Literal["buy", "sell"]
    qty: float
    price: float
    timestamp: str

class TaxRequest(BaseModel):
    transactions: List[Transaction]
    method: Literal["FIFO", "LIFO", "HIFO"]

class TaxResponse(BaseModel):
    realized_pnl: float
    remaining_lots: List[Dict[str, Any]]

@router.post("", response_model=TaxResponse)
async def calculate_tax_lots(request: TaxRequest):
    # Sort transactions by timestamp to ensure chronological processing
    sorted_txs = sorted(request.transactions, key=lambda x: datetime.fromisoformat(x.timestamp))
    
    lots = []  # List of {qty, price, timestamp}
    total_pnl = 0.0

    for tx in sorted_txs:
        if tx.type == "buy":
            lots.append({
                "qty": tx.qty,
                "price": tx.price,
                "timestamp": tx.timestamp
            })
        elif tx.type == "sell":
            remaining_to_sell = tx.qty
            
            while remaining_to_sell > 0 and lots:
                # Select lot based on method
                if request.method == "FIFO":
                    # FIFO: First lot (earliest)
                    lot_idx = 0
                elif request.method == "LIFO":
                    # LIFO: Last lot (latest)
                    lot_idx = len(lots) - 1
                elif request.method == "HIFO":
                    # HIFO: Highest price lot first
                    lot_idx = max(range(len(lots)), key=lambda i: lots[i]["price"])
                
                lot = lots[lot_idx]
                sell_qty = min(remaining_to_sell, lot["qty"])
                
                # Realized PnL = qty * (sell_price - buy_price)
                total_pnl += sell_qty * (tx.price - lot["price"])
                
                # Update lot
                lot["qty"] -= sell_qty
                remaining_to_sell -= sell_qty
                
                if lot["qty"] <= 0:
                    lots.pop(lot_idx)

    return {
        "realized_pnl": round(total_pnl, 2),
        "remaining_lots": lots
    }
