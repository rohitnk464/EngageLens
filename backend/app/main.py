"""
FastAPI application entry point.
Configures CORS, routers, and startup events.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.services.embeddings import initialize_vector_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: initialize ChromaDB
    settings = get_settings()
    print(f"🚀 Initializing ChromaDB at {settings.chroma_persist_dir}")
    initialize_vector_store()
    print("✅ Vector store ready")
    yield
    # Shutdown: cleanup if needed
    print("👋 Shutting down")


app = FastAPI(
    title="Video Comparison RAG Chatbot",
    description="RAG-powered chatbot that compares social media videos using LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to connect
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ──────────────────────────────────────────────────────────────────

from app.routers import analyze, chat  # noqa: E402

app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}
