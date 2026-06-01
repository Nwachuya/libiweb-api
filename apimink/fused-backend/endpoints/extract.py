import httpx
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup

router = APIRouter(prefix="/extract", tags=["Data Extraction"])

class ExtractRequest(BaseModel):
    url: HttpUrl
    extract_json_ld: bool = True
    extract_meta: bool = True

class ExtractResponse(BaseModel):
    url: str
    json_ld: List[Dict[str, Any]]
    metadata: Dict[str, str]
    schema_org_types: List[str]

@router.post("", response_model=ExtractResponse)
async def extract_structured_data(request: ExtractRequest):
    headers = {"User-Agent": "Fused-Structured-Extractor/1.0"}
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # 1. Extract JSON-LD
    json_ld_data = []
    if request.extract_json_ld:
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    json_ld_data.extend(data)
                else:
                    json_ld_data.append(data)
            except:
                continue
                
    # 2. Extract Meta Tags
    metadata = {}
    if request.extract_meta:
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property')
            content = meta.get('content')
            if name and content:
                metadata[name] = content
                
    # 3. Identify Schema.org types
    types = []
    for item in json_ld_data:
        t = item.get('@type')
        if t:
            if isinstance(t, list):
                types.extend(t)
            else:
                types.append(t)
                
    return ExtractResponse(
        url=str(response.url),
        json_ld=json_ld_data,
        metadata=metadata,
        schema_org_types=list(set(types))
    )
