"""
LangGraph workflow definition for the RAG chatbot.

Builds a StateGraph with nodes:
  retrieve → generate

Supports:
- Conversation memory via MemorySaver checkpointer
- Streaming via astream_events
- Session-based thread management
"""

import json
import logging
from typing import AsyncGenerator, Optional

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.rag.state import GraphState
from app.rag.nodes import retrieve, generate, generate_deep_analysis
from app.rag.prompts import SYSTEM_PROMPT, GENERATION_PROMPT

logger = logging.getLogger(__name__)

# ─── Checkpointer (conversation memory) ─────────────────────────────────────
checkpointer = MemorySaver()

# ─── Session metadata store ─────────────────────────────────────────────────
# Maps session_id → metadata_context string
_session_metadata: dict[str, str] = {}


def store_session_metadata(session_id: str, metadata_context: str):
    """Store metadata context for a session."""
    _session_metadata[session_id] = metadata_context


def get_session_metadata(session_id: str) -> str:
    """Get metadata context for a session."""
    return _session_metadata.get(session_id, "")


# ─── Build the RAG Graph ─────────────────────────────────────────────────────

def build_rag_graph() -> StateGraph:
    """
    Build the LangGraph RAG workflow.

    Flow: START → retrieve → generate → END
    """
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("generate", generate)

    # Define edges
    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "generate")
    workflow.add_edge("generate", END)

    return workflow


def get_compiled_graph():
    """Compile the graph with memory checkpointer."""
    workflow = build_rag_graph()
    return workflow.compile(checkpointer=checkpointer)


# Module-level compiled graph
_graph = None


def get_graph():
    """Get or create the compiled graph (singleton)."""
    global _graph
    if _graph is None:
        _graph = get_compiled_graph()
    return _graph


# ─── Streaming Interface ─────────────────────────────────────────────────────

async def stream_response(
    question: str,
    session_id: str,
    is_deep_analysis: bool = False,
) -> AsyncGenerator[dict, None]:
    """
    Stream a RAG response for a user question.

    Yields SSE events:
    - {"type": "token", "content": "..."} — streaming tokens
    - {"type": "sources", "sources": [...]} — source citations
    - {"type": "done"} — stream complete
    - {"type": "error", "content": "..."} — error message

    Args:
        question: User's question
        session_id: Session ID for memory/metadata
        is_deep_analysis: If True, use deep analysis prompt
    """
    settings = get_settings()
    metadata_context = get_session_metadata(session_id)

    if not metadata_context:
        yield {"type": "error", "content": "No videos analyzed yet. Please analyze videos first."}
        return

    config = {"configurable": {"thread_id": session_id}}

    # Initial state
    initial_state = {
        "messages": [HumanMessage(content=question)],
        "question": question,
        "documents_a": [],
        "documents_b": [],
        "metadata_context": metadata_context,
        "generation": "",
        "sources": [],
    }

    try:
        # For streaming, we use the LangGraph graph to retrieve first,
        # then stream the LLM generation token by token
        graph = get_graph()

        # Step 1: Run retrieval synchronously to get context
        # We invoke just the retrieve step
        from app.rag.nodes import retrieve as retrieve_node
        retrieval_result = retrieve_node(initial_state)

        docs_a = retrieval_result.get("documents_a", [])
        docs_b = retrieval_result.get("documents_b", [])

        # Step 2: Format chunks
        from app.rag.nodes import _format_chunks, _build_sources

        chunks_a_text = _format_chunks(docs_a, "A")
        chunks_b_text = _format_chunks(docs_b, "B")

        # Step 3: Choose prompt
        if is_deep_analysis:
            from app.rag.prompts import DEEP_ANALYSIS_PROMPT
            prompt = DEEP_ANALYSIS_PROMPT.format(
                metadata_context=metadata_context,
                chunks_a=chunks_a_text,
                chunks_b=chunks_b_text,
            )
        else:
            prompt = GENERATION_PROMPT.format(
                metadata_context=metadata_context,
                chunks_a=chunks_a_text,
                chunks_b=chunks_b_text,
                question=question,
            )

        # Step 4: Stream LLM response
        llm = ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.openai_api_key,
            temperature=0.3,
            streaming=True,
        )

        # Build messages with conversation history from checkpointer
        llm_messages = [SystemMessage(content=SYSTEM_PROMPT)]

        # Get prior conversation state from checkpointer
        try:
            checkpoint = checkpointer.get(config)
            if checkpoint and "channel_values" in checkpoint:
                prior_messages = checkpoint["channel_values"].get("messages", [])
                for msg in prior_messages:
                    llm_messages.append(msg)
        except Exception:
            pass  # No prior history

        llm_messages.append(HumanMessage(content=prompt))

        # Stream tokens
        full_response = ""
        async for chunk in llm.astream(llm_messages):
            if chunk.content:
                full_response += chunk.content
                yield {"type": "token", "content": chunk.content}

        # Save to checkpointer memory
        try:
            graph.invoke(
                {
                    "messages": [
                        HumanMessage(content=question),
                        AIMessage(content=full_response),
                    ],
                    "question": question,
                    "documents_a": docs_a,
                    "documents_b": docs_b,
                    "metadata_context": metadata_context,
                    "generation": full_response,
                    "sources": [],
                },
                config=config,
            )
        except Exception as e:
            logger.warning(f"Failed to save to checkpointer: {e}")

        # Send sources
        sources = _build_sources(docs_a, docs_b)
        yield {"type": "sources", "sources": sources}

        # Done
        yield {"type": "done"}

    except Exception as e:
        logger.error(f"Stream error: {e}", exc_info=True)
        yield {"type": "error", "content": f"An error occurred: {str(e)}"}
