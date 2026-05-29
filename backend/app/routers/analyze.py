"""
POST /api/analyze — Ingest and process two video URLs.

Pipeline:
1. Extract transcripts + metadata for both videos
2. Compute engagement rates
3. Chunk and embed transcripts into ChromaDB
4. Return metadata + session_id for chat
"""

import uuid
import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    AnalyzeRequest, AnalyzeResponse, VideoLabel,
)
from app.services.transcript import extract_video_data
from app.services.embeddings import embed_and_store, clear_session_data
from app.services.metadata import format_metadata_context
from app.rag.graph import store_session_metadata

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_videos(request: AnalyzeRequest):
    """
    Analyze two videos — extract transcripts, compute engagement,
    embed transcripts, and prepare for chat.

    Returns metadata for both videos and a session_id for subsequent chat.
    """
    session_id = str(uuid.uuid4())

    try:
        # ─── Extract Video A ────────────────────────────────────────
        logger.info(f"[{session_id}] Extracting Video A: {request.video_a_url}")
        try:
            video_a = extract_video_data(request.video_a_url, VideoLabel.A)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to process Video A: {str(e)}"
            )

        # ─── Extract Video B ────────────────────────────────────────
        logger.info(f"[{session_id}] Extracting Video B: {request.video_b_url}")
        try:
            video_b = extract_video_data(request.video_b_url, VideoLabel.B)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to process Video B: {str(e)}"
            )

        # ─── Clear old data for these videos ────────────────────────
        clear_session_data([
            video_a.metadata.video_id,
            video_b.metadata.video_id,
        ])

        # ─── Embed transcripts ──────────────────────────────────────
        logger.info(f"[{session_id}] Embedding Video A transcript...")
        chunks_a = embed_and_store(video_a)

        logger.info(f"[{session_id}] Embedding Video B transcript...")
        chunks_b = embed_and_store(video_b)

        total_chunks = chunks_a + chunks_b

        # ─── Store metadata context for RAG ─────────────────────────
        metadata_context = format_metadata_context(
            video_a.metadata, video_b.metadata
        )
        store_session_metadata(session_id, metadata_context)

        logger.info(
            f"[{session_id}] Analysis complete. "
            f"Stored {total_chunks} chunks. "
            f"Video A ER: {video_a.metadata.engagement_rate:.2f}%, "
            f"Video B ER: {video_b.metadata.engagement_rate:.2f}%"
        )

        return AnalyzeResponse(
            session_id=session_id,
            video_a=video_a.metadata,
            video_b=video_b.metadata,
            chunks_stored=total_chunks,
            message=f"Successfully analyzed both videos. {total_chunks} transcript chunks embedded.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{session_id}] Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )
