import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict
from bs4 import BeautifulSoup

router = APIRouter(prefix="/seo", tags=["Marketing / SEO"])

class SEORequest(BaseModel):
    url: HttpUrl

class SEOAudit(BaseModel):
    score: float
    issues: List[str]
    metadata: Dict[str, str]
    heading_structure: Dict[str, int]
    performance_hints: List[str]

@router.post("", response_model=SEOAudit)
async def analyze_seo(request: SEORequest):
    headers = {"User-Agent": "Fused-SEO-Analyzer/1.0"}
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    
    issues = []
    score = 100.0
    
    # 1. Title Analysis
    title_tag = soup.title
    title_text = title_tag.string.strip() if title_tag and title_tag.string else ""
    if not title_text:
        issues.append("Missing <title> tag.")
        score -= 20
    elif len(title_text) < 30 or len(title_text) > 60:
        issues.append(f"Title length ({len(title_text)}) is not optimal (recommended 30-60).")
        score -= 5
        
    # 2. Meta Description
    desc_tag = soup.find("meta", attrs={"name": "description"})
    desc_text = desc_tag.get("content", "").strip() if desc_tag else ""
    if not desc_text:
        issues.append("Missing meta description.")
        score -= 15
    elif len(desc_text) < 120 or len(desc_text) > 160:
        issues.append(f"Meta description length ({len(desc_text)}) is not optimal (recommended 120-160).")
        score -= 5
        
    # 3. Headings
    h1s = soup.find_all('h1')
    if len(h1s) == 0:
        issues.append("Missing H1 heading.")
        score -= 10
    elif len(h1s) > 1:
        issues.append(f"Multiple H1 headings found ({len(h1s)}).")
        score -= 5
        
    # 4. Images
    images = soup.find_all('img')
    missing_alt = [img for img in images if not img.get('alt')]
    if missing_alt:
        issues.append(f"{len(missing_alt)} images are missing 'alt' attributes.")
        score -= (min(len(missing_alt), 10) * 1) # Max 10 point penalty
        
    # 5. Social Tags
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if not og_title:
        issues.append("Missing OpenGraph title (og:title).")
        score -= 5
        
    # Stats
    heading_structure = {
        "h1": len(h1s),
        "h2": len(soup.find_all('h2')),
        "h3": len(soup.find_all('h3')),
        "h4": len(soup.find_all('h4'))
    }
    
    # Performance Hint (rough check for many scripts)
    scripts = soup.find_all('script')
    performance_hints = []
    if len(scripts) > 20:
        performance_hints.append("High number of script tags detected; consider consolidation.")
        
    return SEOAudit(
        score=max(0.0, score),
        issues=issues,
        metadata={
            "title": title_text,
            "description": desc_text,
            "og_title": og_title.get("content", "") if og_title else ""
        },
        heading_structure=heading_structure,
        performance_hints=performance_hints
    )
