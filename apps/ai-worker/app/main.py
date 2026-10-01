import logging
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai_worker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    key_preview = f"{settings.openai_api_key[:12]}... (len={len(settings.openai_api_key)})" if settings.openai_api_key else "EMPTY / NOT SET"
    kie_preview = f"{settings.kie_api_key[:8]}... (len={len(settings.kie_api_key)})" if settings.kie_api_key else "EMPTY / NOT SET"
    logger.info("=" * 70)
    logger.info(f"[system] {settings.app_name} starting...")
    logger.info(f"  - Environment:            {settings.app_env}")
    logger.info(f"  - Host / Port:            {settings.host}:{settings.port}")
    logger.info(f"  - AI Mock Mode:           {settings.ai_mock_mode}")
    logger.info(f"  - OpenAI Base URL:        {settings.openai_base_url or 'https://api.openai.com/v1 (default)'}")
    logger.info(f"  - OpenAI Vision Model:    {settings.openai_vision_model}")
    logger.info(f"  - OpenAI Key Configured:  {key_preview}")
    logger.info(f"  - Kie Model:              {settings.kie_model}")
    logger.info(f"  - Kie Key Configured:     {kie_preview}")
    logger.info(f"  - Supabase Bucket:        {settings.supabase_ai_bucket}")
    logger.info("=" * 70)
    yield
    logger.info(f"[system] Shutting down {settings.app_name}...")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
)

# HTTP Request Logging Middleware
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    method = request.method

    logger.info(f"[http] -> {method} {path} from {client_ip}")
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        logger.info(f"[http] <- {method} {path} status={response.status_code} ({duration_ms:.1f}ms)")
        return response
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(f"[http] <- {method} {path} error={e} ({duration_ms:.1f}ms)", exc_info=True)
        raise



# Internal network CORS policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"name": settings.app_name, "status": "running"}

