from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.routers.v1.router import api_router

import app.models  # noqa: F401  ensures every model is registered on Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.resolve(settings.recordings_dir).mkdir(parents=True, exist_ok=True)
    settings.resolve(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Cognitive Interview AI API",
    description="Layered FastAPI backend for voice-driven mock/practice interviews with RAG-backed question selection.",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {"service": "Cognitive Interview AI API", "docs": "/docs"}
