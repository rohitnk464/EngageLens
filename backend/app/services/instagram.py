"""
Instagram Reel transcript and metadata extraction service.

Uses yt-dlp for video download + metadata, and OpenAI Whisper API
for transcription (since Instagram doesn't provide transcripts).

Instagram scraping is inherently fragile — this module includes
robust fallback handling for when metadata is partially available.
"""

import re
import os
import json
import subprocess
import tempfile
import logging
from typing import Optional, Tuple

from openai import OpenAI

from app.config import get_settings
from app.models.schemas import (
    VideoMetadata, TranscriptChunk, VideoData,
    Platform, VideoLabel,
)

logger = logging.getLogger(__name__)


# ─── URL Parsing ─────────────────────────────────────────────────────────────

def extract_instagram_shortcode(url: str) -> Optional[str]:
    """
    Extract shortcode from Instagram Reel URL.
    Formats:
    - https://www.instagram.com/reel/ABC123/
    - https://www.instagram.com/reels/ABC123/
    - https://www.instagram.com/p/ABC123/
    """
    match = re.search(r'instagram\.com/(?:reel|reels|p)/([A-Za-z0-9_-]+)', url)
    return match.group(1) if match else None


def is_instagram_url(url: str) -> bool:
    """Check if a URL is an Instagram URL."""
    return bool(re.search(r'instagram\.com', url))


# ─── Metadata Extraction ─────────────────────────────────────────────────────

def get_instagram_metadata(url: str, shortcode: str) -> dict:
    """
    Extract Instagram Reel metadata using yt-dlp.

    Uses --cookies-from-browser for authentication since Instagram
    requires login for most content access.

    Returns dict with available metadata fields.
    """
    settings = get_settings()

    # Try with browser cookies first, then without
    commands = [
        ["yt-dlp", "--dump-json", "--no-download",
         "--cookies-from-browser", settings.instagram_browser, url],
        ["yt-dlp", "--dump-json", "--no-download", url],
    ]

    for cmd in commands:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=45,
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                return _parse_instagram_metadata(data, shortcode)

        except subprocess.TimeoutExpired:
            logger.warning(f"yt-dlp timed out for Instagram: {url}")
            continue
        except json.JSONDecodeError:
            logger.warning(f"yt-dlp returned invalid JSON for Instagram: {url}")
            continue
        except FileNotFoundError:
            logger.error("yt-dlp not found. Install with: pip install yt-dlp")
            break
        except Exception as e:
            logger.warning(f"yt-dlp error for Instagram: {e}")
            continue

    logger.warning(f"All yt-dlp attempts failed for Instagram: {url}")
    return _fallback_instagram_metadata(shortcode)


def _parse_instagram_metadata(data: dict, shortcode: str) -> dict:
    """Parse yt-dlp JSON output into our metadata format."""
    return {
        "title": data.get("title", data.get("description", "")[:100]),
        "creator": data.get("uploader", data.get("channel", "")),
        "creator_followers": data.get("channel_follower_count"),
        "views": data.get("view_count", 0) or 0,
        "likes": data.get("like_count", 0) or 0,
        "comments": data.get("comment_count", 0) or 0,
        "upload_date": _format_date(data.get("upload_date", "")),
        "duration": data.get("duration"),
        "thumbnail_url": data.get("thumbnail", ""),
        "description": data.get("description", ""),
        "hashtags": _extract_hashtags(data.get("description", "")),
    }


def _fallback_instagram_metadata(shortcode: str) -> dict:
    """Minimal metadata when yt-dlp fails for Instagram."""
    return {
        "title": f"Instagram Reel ({shortcode})",
        "creator": "Unknown",
        "creator_followers": None,
        "views": 0,
        "likes": 0,
        "comments": 0,
        "upload_date": None,
        "duration": None,
        "thumbnail_url": "",
        "description": "",
        "hashtags": [],
    }


def _format_date(date_str: str) -> Optional[str]:
    """Convert YYYYMMDD to YYYY-MM-DD."""
    if date_str and len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str or None


def _extract_hashtags(text: str) -> list[str]:
    """Extract hashtags from description text."""
    return re.findall(r'#(\w+)', text)


# ─── Audio Download + Transcription ──────────────────────────────────────────

def download_instagram_audio(url: str) -> Optional[str]:
    """
    Download audio from Instagram Reel using yt-dlp.

    Returns path to downloaded audio file, or None if download fails.
    """
    settings = get_settings()

    # Create temp directory for audio files
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp_audio")
    os.makedirs(temp_dir, exist_ok=True)

    output_path = os.path.join(temp_dir, "%(id)s.%(ext)s")

    # Try with browser cookies first
    commands = [
        [
            "yt-dlp",
            "-x",                         # Extract audio only
            "--audio-format", "mp3",       # Convert to mp3
            "--audio-quality", "0",        # Best quality
            "-o", output_path,
            "--cookies-from-browser", settings.instagram_browser,
            url,
        ],
        [
            "yt-dlp",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "-o", output_path,
            url,
        ],
    ]

    for cmd in commands:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )

            if result.returncode == 0:
                # Find the downloaded file
                for f in os.listdir(temp_dir):
                    if f.endswith(".mp3"):
                        return os.path.join(temp_dir, f)

        except subprocess.TimeoutExpired:
            logger.warning("Audio download timed out")
            continue
        except Exception as e:
            logger.warning(f"Audio download error: {e}")
            continue

    return None


def transcribe_audio_whisper(audio_path: str) -> Tuple[str, list[TranscriptChunk]]:
    """
    Transcribe audio file using OpenAI Whisper API.

    Returns:
        Tuple of (full_text, list of TranscriptChunk with timestamps)
    """
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    try:
        with open(audio_path, "rb") as audio_file:
            # Use verbose_json to get timestamps
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        # Extract segments with timing
        chunks = []
        if hasattr(response, 'segments') and response.segments:
            for segment in response.segments:
                chunks.append(TranscriptChunk(
                    text=segment.get('text', '').strip(),
                    start_time=segment.get('start', 0.0),
                    duration=segment.get('end', 0.0) - segment.get('start', 0.0),
                ))

        full_text = response.text if hasattr(response, 'text') else ""

        logger.info(f"Transcribed audio: {len(chunks)} segments, {len(full_text)} chars")
        return full_text, chunks

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise ValueError(f"Failed to transcribe audio: {str(e)}")
    finally:
        # Clean up audio file
        try:
            os.remove(audio_path)
        except OSError:
            pass


def get_instagram_transcript(url: str) -> Tuple[str, list[TranscriptChunk]]:
    """
    Get transcript for Instagram Reel by downloading audio and transcribing.

    Pipeline: yt-dlp (download audio) → Whisper API (transcribe)
    """
    logger.info(f"Downloading Instagram audio for transcription: {url}")

    audio_path = download_instagram_audio(url)
    if not audio_path:
        raise ValueError(
            "Could not download Instagram audio. "
            "Make sure you're logged into Instagram in your browser, "
            "or try providing the video transcript manually."
        )

    logger.info(f"Audio downloaded to {audio_path}, transcribing with Whisper...")
    return transcribe_audio_whisper(audio_path)


# ─── Combined Extraction ─────────────────────────────────────────────────────

def compute_engagement_rate(likes: int, comments: int, views: int) -> float:
    """Compute engagement rate = (likes + comments) / views * 100."""
    if views == 0:
        return 0.0
    return round((likes + comments) / views * 100, 4)


def extract_instagram_data(url: str, label: VideoLabel) -> VideoData:
    """
    Extract all data for an Instagram Reel.

    Args:
        url: Instagram Reel URL
        label: VideoLabel.A or VideoLabel.B

    Returns:
        VideoData with metadata and transcript
    """
    shortcode = extract_instagram_shortcode(url)
    if not shortcode:
        raise ValueError(f"Could not extract Instagram shortcode from URL: {url}")

    # Get metadata
    logger.info(f"Fetching metadata for Instagram Reel: {shortcode}")
    meta_dict = get_instagram_metadata(url, shortcode)

    # Get transcript (download audio + Whisper)
    logger.info(f"Fetching transcript for Instagram Reel: {shortcode}")
    try:
        full_text, chunks = get_instagram_transcript(url)
    except ValueError as e:
        logger.warning(f"Transcript extraction failed: {e}")
        full_text = ""
        chunks = []

    # Compute engagement rate
    views = meta_dict.get("views", 0)
    likes = meta_dict.get("likes", 0)
    comments = meta_dict.get("comments", 0)
    engagement_rate = compute_engagement_rate(likes, comments, views)

    metadata = VideoMetadata(
        video_id=shortcode,
        platform=Platform.INSTAGRAM,
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
