import httpx
import re
import math
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Set
from bs4 import BeautifulSoup

router = APIRouter(prefix="/emails", tags=["Data Extraction"])

class EmailRequest(BaseModel):
    url: HttpUrl
    deep_scan: bool = False # If True, would theoretically follow contact pages, but we'll stick to single page for now

class EmailResponse(BaseModel):
    url: str
    emails: List[str]
    count: int
    obfuscation_detected: bool

def calculate_entropy(s: str) -> float:
    """Calculate Shannon Entropy to detect random noise/encoded strings."""
    if not s: return 0.0
    prob = [float(s.count(c)) / len(s) for c in dict.fromkeys(list(s))]
    return - sum([p * math.log(p, 2) for p in prob])

def deobfuscate_text(text: str) -> str:
    """Handle common email obfuscation patterns."""
    text = re.sub(r'\s*\[at\]\s*', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\(at\)\s*', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\[dot\]\s*', '.', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\(dot\)\s*', '.', text, flags=re.IGNORECASE)
    return text

@router.post("", response_model=EmailResponse)
async def extract_emails(request: EmailRequest):
    headers = {"User-Agent": "Fused-Email-Scraper/1.0"}
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        try:
            response = await client.get(str(request.url), headers=headers)
            response.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")
            
    # 1. Preliminary cleaning
    raw_content = response.text
    clean_content = deobfuscate_text(raw_content)
    
    # 2. Regex Extraction
    # Standard email regex
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    found_emails = re.findall(email_pattern, clean_content)
    
    # 3. Filtering and Validation
    results: Set[str] = set()
    obfuscation_detected = (raw_content != clean_content)
    
    for email in found_emails:
        # Ignore binary noise / encoded strings using entropy
        # Most valid emails have entropy between 3.5 and 4.5
        # High entropy (> 5.0) usually means random noise or base64
        if calculate_entropy(email) < 5.0:
            # Basic validation of domain part
            if '.' in email.split('@')[1]:
                results.add(email.lower())
                
    # 4. Check mailto: links specifically
    soup = BeautifulSoup(raw_content, 'html.parser')
    for a in soup.find_all('a', href=True):
        if a['href'].startswith('mailto:'):
            email = a['href'].replace('mailto:', '').split('?')[0]
            if re.match(email_pattern, email):
                results.add(email.lower())

    return EmailResponse(
        url=str(response.url),
        emails=sorted(list(results)),
        count=len(results),
        obfuscation_detected=obfuscation_detected
    )
