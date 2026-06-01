import re
from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel, HttpUrl
import httpx
from bs4 import BeautifulSoup, NavigableString

router = APIRouter(prefix="/aeo", tags=["Marketing / SEO"])

class AEORequest(BaseModel):
    url: Optional[HttpUrl] = None
    html: Optional[str] = None
    include_summary_block: bool = True

def html_to_markdown(element):
    markdown = ""
    
    for child in element.children:
        if isinstance(child, NavigableString):
            text = child.strip()
            if text: markdown += text + " "
        else:
            if child.name in ['h1', 'h2', 'h3']:
                level = int(child.name[1])
                markdown += f"\n\n{'#' * level} {child.get_text().strip()}\n\n"
            elif child.name == 'p':
                markdown += f"\n\n{child.get_text().strip()}\n\n"
            elif child.name == 'li':
                markdown += f"\n- {child.get_text().strip()}"
            elif child.name == 'strong' or child.name == 'b':
                markdown += f"**{child.get_text().strip()}**"
            elif child.name == 'blockquote':
                markdown += f"\n> {child.get_text().strip()}\n"
            else:
                markdown += html_to_markdown(child)
                
    return re.sub(r'\n{3,}', '\n\n', markdown).strip()

@router.post("")
async def convert_to_aeo_markdown(request: AEORequest):
    html_content = request.html
    
    if not html_content:
        if not request.url:
            raise HTTPException(status_code=400, detail="Either 'url' or 'html' must be provided.")
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            try:
                response = await client.get(str(request.url), headers={"User-Agent": "Fused-AEO-Bot/1.0"})
                response.raise_for_status()
                html_content = response.text
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to fetch URL: {str(e)}")

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 1. Clean the DOM
    for tag in soup(['nav', 'footer', 'aside', 'script', 'style', 'header', 'form']):
        tag.decompose()
        
    # 2. Extract Main Content
    # Try common semantic tags first
    main_content = soup.find('main') or soup.find('article') or soup.find('div', {'id': 'content'})
    
    # Fallback: Find the div with the most paragraphs
    if not main_content:
        divs = soup.find_all('div')
        if divs:
            main_content = max(divs, key=lambda d: len(d.find_all('p')))
        else:
            main_content = soup.body if soup.body else soup
            
    # 3. Process into LLM-Ready Markdown
    title = soup.title.string if soup.title else "Untitled Document"
    raw_markdown = html_to_markdown(main_content)
    
    # 4. Generate AEO Summary Block (specifically for llms.txt standard)
    summary_block = ""
    if request.include_summary_block:
        # Simple extraction of first 2 paragraphs for summary
        paragraphs = main_content.find_all('p')
        summary_text = " ".join([p.get_text() for p in paragraphs[:2]])
        summary_block = f"> [!SUMMARY]\n> {summary_text[:300]}...\n\n"

    final_markdown = f"# {title}\n\n{summary_block}{raw_markdown}"
    
    return {
        "title": title,
        "aeo_markdown": final_markdown,
        "word_count": len(raw_markdown.split()),
        "optimization_status": "LLM-Ready",
        "format": "llms.txt compliant"
    }
