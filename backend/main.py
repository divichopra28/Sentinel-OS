"""SentinelOS FastAPI entrypoint."""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from api.routes_reports import router as reports_router  # noqa: E402
from api.routes_scan import router as scan_router  # noqa: E402

app = FastAPI(title="SentinelOS API", version="0.1.0")

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
app.include_router(reports_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
