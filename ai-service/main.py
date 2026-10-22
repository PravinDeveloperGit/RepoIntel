"""
Repository Intelligence — AI Service
Entry point: uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import indexing, search, qa, evaluation, repository
from core.index_store import IndexStore

# ── Application lifecycle ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[AI Service] Starting up...")
    IndexStore.initialize()
    yield
    # Shutdown
    print("[AI Service] Shutting down...")

app = FastAPI(
    title="Repository Intelligence AI Service",
    version="1.0.0",
    description="Hybrid retrieval, reranking, and grounded Q&A for source code",
    lifespan=lifespan,
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:4000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(indexing.router, prefix="", tags=["Indexing"])
app.include_router(search.router, prefix="", tags=["Search"])
app.include_router(qa.router, prefix="", tags=["Q&A"])
app.include_router(evaluation.router, prefix="", tags=["Evaluation"])
app.include_router(repository.router, prefix="", tags=["Repository"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}
