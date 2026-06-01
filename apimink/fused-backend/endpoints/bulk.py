import asyncio
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional
from endpoints.crawl import crawl_url, CrawlRequest
from endpoints.seo import analyze_seo, SEORequest
from endpoints.emails import extract_emails, EmailRequest
from endpoints.text import extract_text, TextRequest

router = APIRouter(prefix="/bulk", tags=["System"])

class BulkTask(BaseModel):
    url: HttpUrl
    engine: str # 'crawl', 'seo', 'emails', 'text'

class BulkRequest(BaseModel):
    tasks: List[BulkTask]

class BulkResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int
    success_count: int

@router.post("", response_model=BulkResponse)
async def process_bulk_tasks(request: BulkRequest):
    results = []
    success_count = 0
    
    # Define a mapping of engine names to handler functions
    engine_map = {
        "crawl": lambda u: crawl_url(CrawlRequest(url=u)),
        "seo": lambda u: analyze_seo(SEORequest(url=u)),
        "emails": lambda u: extract_emails(EmailRequest(url=u)),
        "text": lambda u: extract_text(TextRequest(url=u))
    }
    
    # We use asyncio.gather to run tasks in parallel
    async def run_task(task):
        nonlocal success_count
        if task.engine not in engine_map:
            return {"url": str(task.url), "engine": task.engine, "status": "error", "message": "Unknown engine"}
        
        try:
            res = await engine_map[task.engine](task.url)
            success_count += 1
            return {"url": str(task.url), "engine": task.engine, "status": "success", "data": res}
        except Exception as e:
            return {"url": str(task.url), "engine": task.engine, "status": "error", "message": str(e)}

    # Process all tasks
    results = await asyncio.gather(*(run_task(t) for t in request.tasks))
    
    return BulkResponse(
        results=results,
        total=len(request.tasks),
        success_count=success_count
    )
