from fastapi import APIRouter
from pydantic import BaseModel
import jellyfish
from typing import List, Dict, Set

router = APIRouter(prefix="/fuzzy", tags=["Fuzzy"])

class FuzzyRequest(BaseModel):
    items: List[str]
    threshold: float = 0.85

class FuzzyResponse(BaseModel):
    clusters: List[List[str]]

class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, i: int) -> int:
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i: int, j: int):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j

def calculate_similarity(s1: str, s2: str) -> float:
    # 1. Pre-process
    s1_clean = s1.strip().lower()
    s2_clean = s2.strip().lower()
    
    if not s1_clean or not s2_clean:
        return 0.0

    # 2. Levenshtein
    lev = jellyfish.levenshtein_distance(s1_clean, s2_clean)
    lev_sim = 1.0 - (lev / max(len(s1_clean), len(s2_clean)))
    
    # 3. Jaro-Winkler
    jw_sim = jellyfish.jaro_winkler_similarity(s1_clean, s2_clean)
    
    # 4. Soundex
    s1_soundex = jellyfish.soundex(s1_clean)
    s2_soundex = jellyfish.soundex(s2_clean)
    soundex_sim = 1.0 if s1_soundex == s2_soundex else 0.0
    
    # Combined weighted similarity
    return (0.4 * lev_sim) + (0.4 * jw_sim) + (0.2 * soundex_sim)

@router.post("", response_model=FuzzyResponse)
async def deduplicate(request: FuzzyRequest):
    n = len(request.items)
    uf = UnionFind(n)
    
    for i in range(n):
        for j in range(i + 1, n):
            sim = calculate_similarity(request.items[i], request.items[j])
            if sim >= request.threshold:
                uf.union(i, j)
                
    clusters_dict: Dict[int, List[str]] = {}
    for i in range(n):
        root = uf.find(i)
        if root not in clusters_dict:
            clusters_dict[root] = []
        clusters_dict[root].append(request.items[i])
        
    return {"clusters": list(clusters_dict.values())}
