import os
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
API_KEY = os.getenv("API_KEY", "default_secret")

from endpoints.chrono import router as chrono_router
from endpoints.mock import router as mock_router
from endpoints.fuzzy import router as fuzzy_router
from endpoints.token import router as token_router
from endpoints.pack import router as pack_router
from endpoints.diff import router as diff_router
from endpoints.cast import router as cast_router
from endpoints.tax import router as tax_router
from endpoints.policy import router as policy_router
from endpoints.telemetry import router as telemetry_router
from endpoints.series import router as series_router
from endpoints.spatial import router as spatial_router
from endpoints.proration import router as proration_router
from endpoints.apca import router as apca_router
from endpoints.dag import router as dag_router
from endpoints.enforcer import router as enforcer_router
from endpoints.gcode import router as gcode_router
from endpoints.bio import router as bio_router
from endpoints.merkle import router as merkle_router
from endpoints.aeo import router as aeo_router
from endpoints.shifts import router as shifts_router
from endpoints.crawl import router as crawl_router
from endpoints.seo import router as seo_router
from endpoints.emails import router as emails_router
from endpoints.media import router as media_router
from endpoints.text import router as text_router
from endpoints.map import router as map_router
from endpoints.extract import router as extract_router
from endpoints.webhook import router as webhook_router
from endpoints.bulk import router as bulk_router
from endpoints.search import router as search_router

app = FastAPI(
    title="Fused Backend API",
    description="A collection of high-performance, mathematical and computational API endpoints.",
    version="1.0.0"
)

# Authentication Dependency
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API Key")
    return x_api_key

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with global authentication dependency
routers = [
    chrono_router, mock_router, fuzzy_router, token_router, 
    pack_router, diff_router, cast_router, tax_router, 
    policy_router, telemetry_router, series_router, 
    spatial_router, proration_router, apca_router, 
    dag_router, enforcer_router, gcode_router, 
    bio_router, merkle_router, aeo_router, shifts_router,
    crawl_router, seo_router, emails_router, media_router,
    text_router, map_router, extract_router, webhook_router,
    bulk_router, search_router
]

for router in routers:
    app.include_router(router, prefix="/v1", dependencies=[Depends(verify_api_key)])

@app.get("/", tags=["System"])
async def root():
    return {"message": "Welcome to Fused Backend API system. Access /docs for API documentation."}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
