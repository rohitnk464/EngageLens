"""
LangGraph node functions for the RAG workflow.

Each node takes the current GraphState and returns a partial update.
Nodes: retrieve → generate
"""

import logging
from typing import Any

from langchain_core.messages import AIMessage
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.services.embeddings import similarity_search
from app.rag.state import GraphState
from app.rag.prompts import GENERATION_PROMPT, SYSTEM_PROMPT, DEEP_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


# ─── Retrieve Node ───────────────────────────────────────────────────────────

def retrieve(state: GraphState) -> dict[str, Any]:
    """
    Retrieve relevant transcript chunks from ChromaDB for both videos.

    Performs parallel retrieval filtered by video_label A and B,
    then formats chunks with their metadata for the generation prompt.
    """
    question = state["question"]
    logger.info(f"Retrieving chunks for question: {question[:100]}")

    # Retrieve from Video A
    docs_a = similarity_search(query=question, video_label="A", k=5)
    chunks_a = []
    for doc in docs_a:
        chunks_a.append({
            "text": doc.page_content,
            "chunk_index": doc.metadata.get("chunk_index", 0),
            "video_label": "A",
            "relevance_score": doc.metadata.get("relevance_score", 0.0),
        })

    # Retrieve from Video B
    docs_b = similarity_search(query=question, video_label="B", k=5)
    chunks_b = []
    for doc in docs_b:
        chunks_b.append({
            "text": doc.page_content,
            "chunk_index": doc.metadata.get("chunk_index", 0),
            "video_label": "B",
            "relevance_score": doc.metadata.get("relevance_score", 0.0),
        })

    logger.info(f"Retrieved {len(chunks_a)} chunks from A, {len(chunks_b)} chunks from B")

    return {
        "documents_a": chunks_a,
        "documents_b": chunks_b,
    }


# ─── Generate Node ───────────────────────────────────────────────────────────

def generate(state: GraphState) -> dict[str, Any]:
    """
    Generate a response using the LLM with retrieved context.

    Formats the retrieval results and metadata into a prompt,
    then calls GPT-4o-mini to generate an answer with citations.
    """
    settings = get_settings()
    question = state["question"]
    docs_a = state.get("documents_a", [])
    docs_b = state.get("documents_b", [])
    metadata_context = state.get("metadata_context", "")

    # Format chunks for the prompt
    chunks_a_text = _format_chunks(docs_a, "A")
    chunks_b_text = _format_chunks(docs_b, "B")

    # Build the generation prompt
    prompt = GENERATION_PROMPT.format(
        metadata_context=metadata_context,
        chunks_a=chunks_a_text,
        chunks_b=chunks_b_text,
        question=question,
    )

    # Call LLM
    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
        streaming=True,
    )

    messages = state.get("messages", [])

    # Build message list: system + history + current prompt
    from langchain_core.messages import SystemMessage, HumanMessage
    llm_messages = [SystemMessage(content=SYSTEM_PROMPT)]

    # Add conversation history (skip the latest user message since we include it in the prompt)
    for msg in messages[:-1] if messages else []:
        llm_messages.append(msg)

    llm_messages.append(HumanMessage(content=prompt))

    response = llm.invoke(llm_messages)

    # Build source citations
    sources = _build_sources(docs_a, docs_b)

    return {
        "generation": response.content,
        "messages": [AIMessage(content=response.content)],
        "sources": sources,
    }


# ─── Deep Analysis Node ─────────────────────────────────────────────────────

def generate_deep_analysis(state: GraphState) -> dict[str, Any]:
    """
    Generate a comprehensive "Why Video A Won" analysis with scores.

    Uses a specialized prompt that asks for Hook, Retention, CTA,
    Emotional Trigger, and Storytelling scores for both videos.
    """
    settings = get_settings()
    docs_a = state.get("documents_a", [])
    docs_b = state.get("documents_b", [])
    metadata_context = state.get("metadata_context", "")

    chunks_a_text = _format_chunks(docs_a, "A")
    chunks_b_text = _format_chunks(docs_b, "B")

    prompt = DEEP_ANALYSIS_PROMPT.format(
        metadata_context=metadata_context,
        chunks_a=chunks_a_text,
        chunks_b=chunks_b_text,
    )

    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.openai_api_key,
        temperature=0.4,
        streaming=True,
    )

    from langchain_core.messages import SystemMessage, HumanMessage
    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ])

    sources = _build_sources(docs_a, docs_b)

    return {
        "generation": response.content,
        "messages": [AIMessage(content=response.content)],
        "sources": sources,
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _format_chunks(chunks: list[dict], label: str) -> str:
    """Format retrieved chunks into a readable string for the prompt."""
    if not chunks:
        return "No transcript chunks available."

    lines = []
    for chunk in chunks:
        idx = chunk.get("chunk_index", 0)
        text = chunk.get("text", "")
        score = chunk.get("relevance_score", 0.0)
        lines.append(f"[Video {label} - Chunk {idx}] (relevance: {score:.2f})\n{text}")

    return "\n\n".join(lines)


def _build_sources(docs_a: list[dict], docs_b: list[dict]) -> list[dict]:
    """Build source citation list from retrieved documents."""
    sources = []

    for chunk in docs_a:
        sources.append({
            "video_label": "A",
            "chunk_index": chunk.get("chunk_index", 0),
            "chunk_text": chunk.get("text", "")[:200],
            "relevance_score": chunk.get("relevance_score", 0.0),
        })

    for chunk in docs_b:
        sources.append({
            "video_label": "B",
            "chunk_index": chunk.get("chunk_index", 0),
            "chunk_text": chunk.get("text", "")[:200],
            "relevance_score": chunk.get("relevance_score", 0.0),
        })

    # Sort by relevance
    sources.sort(key=lambda x: x["relevance_score"], reverse=True)

    return sources
