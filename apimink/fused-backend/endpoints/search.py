import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from bs4 import BeautifulSoup

router = APIRouter(prefix="/search", tags=["Intelligence / Research"])

class SearchRequest(BaseModel):
    query: str
    limit: int = 10

class SearchResult(BaseModel):
    title: str
    url: str
    content: str

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    count: int

@router.post("", response_model=SearchResponse)
async def perform_search(request: SearchRequest):
    # Using Brave Search which is currently more permissive for HTML scraping
    url = f"https://search.brave.com/search?q={httpx.utils.quote(request.query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html = response.text
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search scraping failed: {str(e)}")

    soup = BeautifulSoup(html, "html.parser")
    results = []
    
    # Selectors based on 2026 Brave Search DOM analysis
    containers = soup.select(".result-content")
    
    for container in containers:
        if len(results) >= request.limit:
            break
            
        title_tag = container.select_one(".title.search-snippet-title")
        url_tag = container.select_one("a.l1")
        snippet_tag = container.select_one(".snippet-description")
        
        if title_tag and url_tag:
            title = title_tag.get_text(strip=True)
            url_val = url_tag.get("href", "")
            content = snippet_tag.get_text(strip=True) if snippet_tag else ""
            
            if url_val.startswith("http"):
                results.append(SearchResult(
                    title=title,
                    url=url_val,
                    content=content
                ))

    return SearchResponse(
        query=request.query,
        results=results,
        count=len(results)
    )
