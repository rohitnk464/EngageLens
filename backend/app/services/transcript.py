"""
Unified transcript extraction service.

Auto-detects platform (YouTube/Instagram) from URL and routes
to the appropriate extraction service.
"""

import logging
from app.models.schemas import VideoData, VideoLabel
from app.services.youtube import is_youtube_url, extract_youtube_data
from app.services.instagram import is_instagram_url, extract_instagram_data

logger = logging.getLogger(__name__)


def detect_platform(url: str) -> str:
    """Detect platform from URL. Returns 'youtube', 'instagram', or raises ValueError."""
    if is_youtube_url(url):
        return "youtube"
    elif is_instagram_url(url):
        return "instagram"
    else:
        raise ValueError(
            f"Unsupported URL: {url}. "
            "Please provide a YouTube or Instagram Reel URL."
        )


def extract_video_data(url: str, label: VideoLabel) -> VideoData:
    """
    Extract all data for a video URL — auto-detects platform.

    Args:
        url: YouTube or Instagram video URL
        label: VideoLabel.A or VideoLabel.B

    Returns:
        VideoData with metadata + transcript

    Raises:
        ValueError if URL is unsupported or extraction fails
    """
    url = url.strip()
    platform = detect_platform(url)

    logger.info(f"Extracting data for {platform} video (Label {label.value}): {url}")

    if platform == "youtube":
        return extract_youtube_data(url, label)
    elif platform == "instagram":
        return extract_instagram_data(url, label)
    else:
        raise ValueError(f"Unsupported platform: {platform}")
