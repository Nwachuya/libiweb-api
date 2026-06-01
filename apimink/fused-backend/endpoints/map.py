import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

router = APIRouter(prefix="/map", tags=["Web Intelligence"])

class MapRequest(BaseModel):
    url: HttpUrl

class MapResponse(BaseModel):
    root_url: str
    internal_links: List[str]
    count: int

@router.post("", response_model=MapResponse)
async def generate_map(request: MapRequest):
    headers = {"User-Agent": "Fused-Sitemap-Generator/1.0"}
    base_domain = urlparse(str(request.url)).netloc
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    internal_links = set()
    
    for a in soup.find_all('a', href=True):
        full_url = urljoin(str(request.url), a['href'])
        parsed = urlparse(full_url)
        
        # Only include links from the same domain
        if parsed.netloc == base_domain:
            # Clean fragment and trailing slash
            clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
            if clean_url:
                internal_links.add(clean_url)
                
    return MapResponse(
        root_url=str(request.url),
        internal_links=sorted(list(internal_links)),
        count=len(internal_links)
    )
