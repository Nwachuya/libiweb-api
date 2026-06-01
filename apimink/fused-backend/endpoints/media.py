import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

router = APIRouter(prefix="/media", tags=["Data Extraction"])

class MediaAsset(BaseModel):
    type: str # 'image', 'video', 'iframe'
    url: str
    alt: Optional[str] = None
    asset_score: float # Computational weight based on size/metadata
    metadata: dict = {}

class MediaRequest(BaseModel):
    url: HttpUrl

class MediaResponse(BaseModel):
    url: str
    assets: List[MediaAsset]
    total_count: int

@router.post("", response_model=MediaResponse)
async def extract_media(request: MediaRequest):
    headers = {"User-Agent": "Fused-Media-Extractor/1.0"}
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    assets = []
    
    # 1. Extract Images
    for img in soup.find_all('img', src=True):
        src = urljoin(str(request.url), img['src'])
        alt = img.get('alt', '')
        
        # Calculate asset score
        # Bonus for alt text, bonus for being a common hero image format
        score = 1.0
        if alt: score += 0.5
        if 'hero' in src.lower() or 'banner' in src.lower(): score += 2.0
        
        assets.append(MediaAsset(
            type='image',
            url=src,
            alt=alt,
            asset_score=score,
            metadata={
                "width": img.get('width', 'auto'),
                "height": img.get('height', 'auto')
            }
        ))
        
    # 2. Extract Videos
    for video in soup.find_all('video'):
        sources = video.find_all('source', src=True)
        for s in sources:
            assets.append(MediaAsset(
                type='video',
                url=urljoin(str(request.url), s['src']),
                asset_score=3.0,
                metadata={"format": s.get('type', 'unknown')}
            ))
            
    # 3. Extract IFrames (YouTube/Vimeo)
    for iframe in soup.find_all('iframe', src=True):
        src = iframe['src']
        if 'youtube' in src or 'vimeo' in src:
            assets.append(MediaAsset(
                type='iframe_video',
                url=src,
                asset_score=5.0,
                metadata={"platform": "third-party-provider"}
            ))
            
    # Sort by asset score descending
    assets.sort(key=lambda x: x.asset_score, reverse=True)
    
    return MediaResponse(
        url=str(response.url),
        assets=assets,
        total_count=len(assets)
    )
