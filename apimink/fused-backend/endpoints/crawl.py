import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

router = APIRouter(prefix="/crawl", tags=["Web Intelligence"])

class CrawlRequest(BaseModel):
    url: HttpUrl
    max_depth: Optional[int] = 1
    include_html: bool = False

class CrawlResponse(BaseModel):
    url: str
    status_code: int
    title: str
    meta_description: Optional[str] = None
    links: List[str] = []
    word_count: int
    html: Optional[str] = None

@router.post("", response_model=CrawlResponse)
async def crawl_url(request: CrawlRequest):
    headers = {
        "User-Agent": "Fused-Backend-Crawler/1.0 (Mozilla/5.0; compatible; FusedBot/1.0)"
    }
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Target URL returned error: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Extract Metadata
    title = soup.title.string.strip() if soup.title else "No Title"
    description = ""
    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if desc_tag:
        description = desc_tag.get("content", "").strip()
        
    # Extract Links
    links = []
    for a in soup.find_all('a', href=True):
        full_url = urljoin(str(request.url), a['href'])
        if full_url.startswith("http"):
            links.append(full_url)
            
    # Clean links (unique)
    links = list(set(links))
    
    # Word count (rough estimate from text)
    text = soup.get_text()
    words = text.split()
    word_count = len(words)
    
    return CrawlResponse(
        url=str(response.url),
        status_code=response.status_code,
        title=title,
        meta_description=description,
        links=links,
        word_count=word_count,
        html=response.text if request.include_html else None
    )
