"""
Pydantic schemas for API requests, responses, and internal data models.
"""

from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ─── Enums ───────────────────────────────────────────────────────────────────

class Platform(str, Enum):
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"


class VideoLabel(str, Enum):
    A = "A"
    B = "B"


# ─── Video Metadata ─────────────────────────────────────────────────────────

class VideoMetadata(BaseModel):
    """Extracted metadata for a single video."""

    video_id: str = Field(..., description="Platform-specific video identifier")
    platform: Platform
    label: VideoLabel = Field(..., description="Video A or Video B")
    url: str
    title: str = ""
    creator: str = ""
    creator_followers: Optional[int] = None
    views: int = 0
    likes: int = 0
    comments: int = 0
    engagement_rate: float = Field(0.0, description="(likes + comments) / views * 100")
    hashtags: List[str] = Field(default_factory=list)
    upload_date: Optional[str] = None
    duration: Optional[int] = Field(None, description="Duration in seconds")
    thumbnail_url: str = ""
    description: str = ""


class TranscriptChunk(BaseModel):
    """A single chunk of transcript text with timing info."""

    text: str
    start_time: float = 0.0
    duration: float = 0.0


class VideoData(BaseModel):
    """Complete extracted data for a video — metadata + transcript."""

    metadata: VideoMetadata
    transcript: str = Field("", description="Full transcript text")
    transcript_chunks: List[TranscriptChunk] = Field(
        default_factory=list,
        description="Transcript with timestamps"
    )


# ─── API Requests ────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request to analyze two videos."""

    video_a_url: str = Field(..., description="URL for Video A (YouTube or Instagram)")
    video_b_url: str = Field(..., description="URL for Video B (YouTube or Instagram)")


class ChatRequest(BaseModel):
    """Request to chat about analyzed videos."""

    message: str = Field(..., description="User's question")
    session_id: str = Field(..., description="Session ID from analyze response")


# ─── API Responses ───────────────────────────────────────────────────────────

class AnalyzeResponse(BaseModel):
    """Response after analyzing two videos."""

    session_id: str
    video_a: VideoMetadata
    video_b: VideoMetadata
    chunks_stored: int = Field(0, description="Total transcript chunks embedded")
    message: str = "Videos analyzed successfully"


class SourceCitation(BaseModel):
    """A source citation for a RAG response."""

    video_label: VideoLabel
    chunk_index: int
    chunk_text: str
    relevance_score: float = 0.0


class ChatEvent(BaseModel):
    """A single SSE event from the chat stream."""

    type: str = Field(..., description="Event type: token, sources, metadata, done, error")
    content: Optional[str] = None
    sources: Optional[List[SourceCitation]] = None
    metadata: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    detail: Optional[str] = None
