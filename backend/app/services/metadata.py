"""
Metadata computation utilities.

Handles engagement rate calculation and formatting metadata
into context strings for the LLM.
"""

from app.models.schemas import VideoMetadata


def compute_engagement_rate(likes: int, comments: int, views: int) -> float:
    """
    Compute engagement rate = (likes + comments) / views × 100.

    Returns 0.0 if views is 0 to avoid division by zero.
    """
    if views == 0:
        return 0.0
    return round((likes + comments) / views * 100, 4)


def format_number(num: int) -> str:
    """Format large numbers for display: 1200000 → '1.2M'."""
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num / 1_000:.1f}K"
    return str(num)


def format_metadata_context(video_a: VideoMetadata, video_b: VideoMetadata) -> str:
    """
    Format video metadata into a context string for the LLM.

    This is injected into every RAG prompt so the model always has
    access to stats without needing to retrieve them from the vector store.
    """
    return f"""=== VIDEO METADATA CONTEXT ===

--- Video A ---
Title: {video_a.title}
Platform: {video_a.platform.value}
Creator: {video_a.creator}
Creator Followers: {format_number(video_a.creator_followers) if video_a.creator_followers else 'N/A'}
Views: {format_number(video_a.views)} ({video_a.views:,})
Likes: {format_number(video_a.likes)} ({video_a.likes:,})
Comments: {format_number(video_a.comments)} ({video_a.comments:,})
Engagement Rate: {video_a.engagement_rate:.2f}%
Hashtags: {', '.join(video_a.hashtags) if video_a.hashtags else 'None'}
Upload Date: {video_a.upload_date or 'N/A'}
Duration: {_format_duration(video_a.duration)}
URL: {video_a.url}

--- Video B ---
Title: {video_b.title}
Platform: {video_b.platform.value}
Creator: {video_b.creator}
Creator Followers: {format_number(video_b.creator_followers) if video_b.creator_followers else 'N/A'}
Views: {format_number(video_b.views)} ({video_b.views:,})
Likes: {format_number(video_b.likes)} ({video_b.likes:,})
Comments: {format_number(video_b.comments)} ({video_b.comments:,})
Engagement Rate: {video_b.engagement_rate:.2f}%
Hashtags: {', '.join(video_b.hashtags) if video_b.hashtags else 'None'}
Upload Date: {video_b.upload_date or 'N/A'}
Duration: {_format_duration(video_b.duration)}
URL: {video_b.url}

=== END METADATA ==="""


def _format_duration(seconds: int | None) -> str:
    """Format seconds into MM:SS or HH:MM:SS."""
    if seconds is None:
        return "N/A"
    mins, secs = divmod(seconds, 60)
    hours, mins = divmod(mins, 60)
    if hours > 0:
        return f"{hours}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"
