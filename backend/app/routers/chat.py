"""
POST /api/chat — SSE streaming chat endpoint.

Accepts a user message + session_id, runs the LangGraph RAG workflow,
and streams tokens back as Server-Sent Events.
"""

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.rag.graph import stream_response, get_session_metadata

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat")
async def chat_stream(request: ChatRequest):
    """
    Stream a RAG-powered response to a user question about analyzed videos.

    Returns Server-Sent Events (SSE) with:
    - data: {"type": "token", "content": "..."} — streaming text
    - data: {"type": "sources", "sources": [...]} — citations
    - data: {"type": "done"} — stream complete
    - data: [DONE] — terminal event
    """
    # Validate session exists
    metadata = get_session_metadata(request.session_id)
    if not metadata:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please analyze videos first."
        )

    # Check if this is a deep analysis request
    is_deep = _is_deep_analysis(request.message)

    async def event_generator():
        try:
            async for event in stream_response(
                question=request.message,
                session_id=request.session_id,
                is_deep_analysis=is_deep,
            ):
                data = json.dumps(event)
                yield f"data: {data}\n\n"

            # Terminal event
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            error_event = json.dumps({
                "type": "error",
                "content": f"An error occurred: {str(e)}"
            })
            yield f"data: {error_event}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _is_deep_analysis(message: str) -> bool:
    """Detect if the user is asking for a deep analysis."""
    deep_keywords = [
        "why did video a win",
        "why video a won",
        "deep analysis",
        "full analysis",
        "comprehensive analysis",
        "score both videos",
        "hook strength",
        "retention score",
    ]
    lower_msg = message.lower()
    return any(kw in lower_msg for kw in deep_keywords)
