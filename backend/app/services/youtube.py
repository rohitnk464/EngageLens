"""
YouTube transcript and metadata extraction service.

Uses youtube-transcript-api for transcripts (free, no API key needed)
and yt-dlp for metadata (title, views, likes, comments, channel info).
"""

import re
import json
import subprocess
import logging
from typing import Optional, Tuple

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from app.models.schemas import VideoMetadata, TranscriptChunk, VideoData, Platform, VideoLabel

logger = logging.getLogger(__name__)


# ─── URL Parsing ─────────────────────────────────────────────────────────────

def extract_youtube_id(url: str) -> Optional[str]:
    """
    Extract video ID from various YouTube URL formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    - https://youtube.com/embed/VIDEO_ID
    """
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/watch\?.*v=)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def is_youtube_url(url: str) -> bool:
    """Check if a URL is a YouTube URL."""
    return bool(re.search(r'(youtube\.com|youtu\.be)', url))


# ─── Transcript Extraction ───────────────────────────────────────────────────

def get_youtube_transcript(video_id: str) -> Tuple[str, list[TranscriptChunk]]:
    """
    Fetch YouTube transcript using youtube-transcript-api.

    Returns:
        Tuple of (full_text, list of TranscriptChunk with timestamps)

    Raises:
        ValueError if transcript is not available
    """
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
    except TranscriptsDisabled:
        raise ValueError(f"Transcripts are disabled for video {video_id}")
    except NoTranscriptFound:
        # Try auto-generated transcripts in any language
        try:
            transcript_entries = YouTubeTranscriptApi.list_transcripts(video_id)
            # Try to find any auto-generated transcript and translate to English
            for transcript in transcript_entries:
                if transcript.is_generated:
                    transcript_list = transcript.translate('en').fetch()
                    break
            else:
                raise ValueError(f"No transcript found for video {video_id}")
        except Exception as e:
            raise ValueError(f"No transcript found for video {video_id}: {str(e)}")
    except VideoUnavailable:
        raise ValueError(f"Video {video_id} is unavailable")

    # Build transcript chunks with timing
    chunks = []
    for entry in transcript_list:
        chunks.append(TranscriptChunk(
            text=entry['text'],
            start_time=entry['start'],
            duration=entry.get('duration', 0.0),
        ))

    # Combine into full text
    full_text = " ".join(entry['text'] for entry in transcript_list)

    logger.info(f"Extracted transcript for {video_id}: {len(chunks)} segments, {len(full_text)} chars")
    return full_text, chunks


# ─── Metadata Extraction ─────────────────────────────────────────────────────

def get_youtube_metadata(url: str, video_id: str) -> dict:
    """
    Extract video metadata using yt-dlp --dump-json.

    Returns dict with: title, views, likes, comments, channel, upload_date,
    duration, thumbnail, description, etc.
    """
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-download", url],
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            logger.warning(f"yt-dlp failed for {url}: {result.stderr}")
            return _fallback_metadata(video_id)

        data = json.loads(result.stdout)

        return {
            "title": data.get("title", ""),
            "creator": data.get("channel", data.get("uploader", "")),
            "creator_followers": data.get("channel_follower_count"),
            "views": data.get("view_count", 0),
            "likes": data.get("like_count", 0),
            "comments": data.get("comment_count", 0),
            "upload_date": _format_date(data.get("upload_date", "")),
            "duration": data.get("duration"),
            "thumbnail_url": data.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"),
            "description": data.get("description", ""),
            "hashtags": _extract_hashtags(data.get("description", "")),
        }

    except subprocess.TimeoutExpired:
        logger.warning(f"yt-dlp timed out for {url}")
        return _fallback_metadata(video_id)
    except json.JSONDecodeError:
        logger.warning(f"yt-dlp returned invalid JSON for {url}")
        return _fallback_metadata(video_id)
    except FileNotFoundError:
        logger.error("yt-dlp not found. Install with: pip install yt-dlp")
        return _fallback_metadata(video_id)


def _fallback_metadata(video_id: str) -> dict:
    """Minimal metadata when yt-dlp fails."""
    return {
        "title": f"YouTube Video ({video_id})",
        "creator": "Unknown",
        "creator_followers": None,
        "views": 0,
        "likes": 0,
        "comments": 0,
        "upload_date": None,
        "duration": None,
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        "description": "",
        "hashtags": [],
    }


def _format_date(date_str: str) -> Optional[str]:
    """Convert YYYYMMDD to YYYY-MM-DD."""
    if len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str or None


def _extract_hashtags(text: str) -> list[str]:
    """Extract hashtags from description text."""
    return re.findall(r'#(\w+)', text)


# ─── Combined Extraction ─────────────────────────────────────────────────────

def extract_youtube_data(url: str, label: VideoLabel) -> VideoData:
    """
    Extract all data for a YouTube video.

    Args:
        url: YouTube video URL
        label: VideoLabel.A or VideoLabel.B

    Returns:
        VideoData with metadata and transcript
    """
    video_id = extract_youtube_id(url)
    if not video_id:
        raise ValueError(f"Could not extract YouTube video ID from URL: {url}")

    # Get metadata via yt-dlp
    logger.info(f"Fetching metadata for YouTube video: {video_id}")
    meta_dict = get_youtube_metadata(url, video_id)

    # Get transcript
    logger.info(f"Fetching transcript for YouTube video: {video_id}")
    full_text, chunks = get_youtube_transcript(video_id)

    # Compute engagement rate
    views = meta_dict.get("views", 0)
    likes = meta_dict.get("likes", 0)
    comments = meta_dict.get("comments", 0)
    engagement_rate = compute_engagement_rate(likes, comments, views)

    metadata = VideoMetadata(
        video_id=video_id,
        platform=Platform.YOUTUBE,
        label=label,
        url=url,
        title=meta_dict.get("title", ""),
        creator=meta_dict.get("creator", ""),
        creator_followers=meta_dict.get("creator_followers"),
        views=views,
        likes=likes,
        comments=comments,
        engagement_rate=engagement_rate,
        hashtags=meta_dict.get("hashtags", []),
        upload_date=meta_dict.get("upload_date"),
        duration=meta_dict.get("duration"),
        thumbnail_url=meta_dict.get("thumbnail_url", ""),
        description=meta_dict.get("description", ""),
    )

    return VideoData(
        metadata=metadata,
        transcript=full_text,
        transcript_chunks=chunks,
    )


def compute_engagement_rate(likes: int, comments: int, views: int) -> float:
    """Compute engagement rate = (likes + comments) / views * 100."""
    if views == 0:
        return 0.0
    return round((likes + comments) / views * 100, 4)
