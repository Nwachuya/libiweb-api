import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from bs4 import BeautifulSoup

router = APIRouter(prefix="/text", tags=["Data Extraction"])

class TextRequest(BaseModel):
    url: HttpUrl

class TextResponse(BaseModel):
    url: str
    text: str
    char_count: int

@router.post("", response_model=TextResponse)
async def extract_text(request: TextRequest):
    headers = {"User-Agent": "Fused-Text-Extractor/1.0"}
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 1. Clean the DOM
    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
        tag.decompose()
        
    # 2. Get text and normalize whitespace
    text = soup.get_text(separator=' ')
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return TextResponse(
        url=str(response.url),
        text=clean_text,
        char_count=len(clean_text)
    )
