import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

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

app = FastAPI(
    title="Fused Backend API",
    description="High-performance computational API endpoints.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["127.0.0.1"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

routers = [
    chrono_router, mock_router, fuzzy_router, token_router,
    pack_router, diff_router, cast_router, tax_router,
    policy_router, telemetry_router, series_router,
    spatial_router, proration_router, apca_router,
    dag_router, enforcer_router, gcode_router,
    bio_router, merkle_router, aeo_router, shifts_router,
]

for router in routers:
    app.include_router(router, prefix="/v1")

@app.get("/")
async def root():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="127.0.0.1", port=port)
