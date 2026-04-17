"""
SmartQuery AI — Production FastAPI Backend
==========================================
Final Year Engineering Project
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import time
import logging
import uuid

from core.config import settings
from core.database import init_db
from routers import auth, query, ai, analytics, history, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("smartquery")

app = FastAPI(
    title="SmartQuery AI",
    description="Natural Language to SQL — Final Year Engineering Project",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_and_timing(request: Request, call_next):
    req_id = str(uuid.uuid4())[:8]
    request.state.req_id = req_id
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Response-Time"] = f"{elapsed}ms"
    logger.info(f"[{req_id}] {request.method} {request.url.path} → {response.status_code} ({elapsed}ms)")
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "path": str(request.url.path)})


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    logger.info("SmartQuery AI backend starting…")
    await init_db()
    logger.info("Database initialised ✓")


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router,      prefix="/api/auth",      tags=["Authentication"])
app.include_router(query.router,     prefix="/api/query",     tags=["Query Engine"])
app.include_router(ai.router,        prefix="/api/ai",        tags=["AI Service"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(history.router,   prefix="/api/history",   tags=["Query History"])
app.include_router(upload.router,    prefix="/api/upload",    tags=["File Upload"])


@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "version": "2.0.0", "service": "SmartQuery AI"}
