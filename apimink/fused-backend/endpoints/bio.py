from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter(prefix="/bio", tags=["Digital Health"])

class BioPairRequest(BaseModel):
    seq1: str
    seq2: str
    match_score: int = 1
    mismatch_penalty: int = -1
    gap_penalty: int = -2

class BioSearchRequest(BaseModel):
    primary_sequence: str
    candidates: List[str]
    match_score: int = 1
    mismatch_penalty: int = -1
    gap_penalty: int = -2

def needleman_wunsch(s1: str, s2: str, match_s: int, mismatch_p: int, gap_p: int):
    n, m = len(s1), len(s2)
    score_matrix = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1): score_matrix[i][0] = i * gap_p
    for j in range(m + 1): score_matrix[0][j] = j * gap_p
    
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            match = score_matrix[i-1][j-1] + (match_s if s1[i-1] == s2[j-1] else mismatch_p)
            delete = score_matrix[i-1][j] + gap_p
            insert = score_matrix[i][j-1] + gap_p
            score_matrix[i][j] = max(match, delete, insert)
            
    # Traceback
    align1, align2 = "", ""
    mutations = []
    i, j = n, m
    matches = 0
    while i > 0 and j > 0:
        curr = score_matrix[i][j]
        diag = score_matrix[i-1][j-1]
        up = score_matrix[i-1][j]
        if curr == diag + (match_s if s1[i-1] == s2[j-1] else mismatch_p):
            if s1[i-1] == s2[j-1]: 
                matches += 1
            else:
                mutations.append(f"Substitution at pos {i}: {s1[i-1]} → {s2[j-1]}")
            align1 += s1[i-1]; align2 += s2[j-1]; i -= 1; j -= 1
        elif curr == up + gap_p:
            mutations.append(f"Gap in Seq2 at pos {i}: {s1[i-1]}")
            align1 += s1[i-1]; align2 += "-"; i -= 1
        else:
            mutations.append(f"Gap in Seq1 at pos {j}: {s2[j-1]}")
            align1 += "-"; align2 += s2[j-1]; j -= 1
            
    while i > 0: align1 += s1[i-1]; align2 += "-"; i -= 1
    while j > 0: align1 += "-"; align2 += s2[j-1]; j -= 1
    
    full_len = max(len(align1), 1)
    return {
        "score": score_matrix[n][m],
        "similarity": round((matches / full_len) * 100, 2),
        "alignment": {"seq1": align1[::-1], "seq2": align2[::-1]},
        "mutations": mutations[::-1]
    }

@router.post("")
async def align_pair(request: BioPairRequest):
    # 1-to-1 Deep Alignment
    s1, s2 = request.seq1.upper(), request.seq2.upper()
    result = needleman_wunsch(s1, s2, request.match_score, request.mismatch_penalty, request.gap_penalty)
    
    return {
        "similarity_index": f"{result['similarity']}%",
        "alignment_score": result['score'],
        "alignment": result['alignment'],
        "audit_trail": {
            "total_variations": len(result['mutations']),
            "details": result['mutations']
        },
        "inference": "High identity" if result['similarity'] > 90 else "Significant genetic drift",
        "algorithm": "Needleman-Wunsch (Pairwise Global)"
    }

@router.post("/search")
async def search_library(request: BioSearchRequest):
    # 1-to-Many Search
    s1 = request.primary_sequence.upper()
    results = []
    for target in request.candidates:
        res = needleman_wunsch(s1, target.upper(), request.match_score, request.mismatch_penalty, request.gap_penalty)
        results.append({
            "target": target,
            "similarity_index": f"{res['similarity']}%",
            "score": res['score'],
            "alignment": res['alignment']
        })
    results.sort(key=lambda x: float(x['similarity_index'].replace('%', '')), reverse=True)
    return {
        "matches_found": len(results),
        "top_match": results[0] if results else None,
        "ranked_results": results
    }
