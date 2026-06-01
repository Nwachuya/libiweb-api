import networkx as nx
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter(prefix="/dag", tags=["Legal / Auditing"])

class Relationship(BaseModel):
    source: str
    target: str
    ownership_percent: float

class DAGRequest(BaseModel):
    relationships: List[Relationship]

@router.post("")
async def analyze_ownership(request: DAGRequest):
    G = nx.DiGraph()
    
    for rel in request.relationships:
        G.add_edge(rel.source, rel.target, weight=rel.ownership_percent)
        
    # 1. Identify Circular Ownership (Cycles)
    # Using Tarjan's via NetworkX
    cycles = list(nx.simple_cycles(G))
    
    # 2. Calculate Maximum Controlling Path and generate Narratives
    conflicts = []
    
    for cycle in cycles:
        impact = 1.0
        path_description = []
        for i in range(len(cycle)):
            u, v = cycle[i], cycle[(i + 1) % len(cycle)]
            weight = G[u][v]['weight']
            impact *= (weight / 100.0)
            path_description.append(f"{u} owns {weight}% of {v}")
        
        # Determine Risk Level
        risk_level = "LOW"
        if impact > 0.5: risk_level = "CRITICAL (Self-Control Loop)"
        elif impact > 0.1: risk_level = "HIGH"
        elif impact > 0.01: risk_level = "MEDIUM"

        conflicts.append({
            "cycle_nodes": cycle,
            "circular_impact_factor": round(impact, 4),
            "risk_level": risk_level,
            "narrative": " -> ".join(path_description),
            "inference": f"Circular ownership detected. A theoretical control loop of {round(impact * 100, 2)}% exists, potentially obfuscating the Ultimate Beneficial Owner (UBO)."
        })

    return {
        "is_acyclic": len(cycles) == 0,
        "audit_status": "Flagged" if cycles else "Clean",
        "cycles_detected": len(cycles),
        "conflicts": conflicts,
        "summary": {
            "total_entities": G.number_of_nodes(),
            "total_relationships": G.number_of_edges(),
            "graph_density": round(nx.density(G), 3)
        }
    }
