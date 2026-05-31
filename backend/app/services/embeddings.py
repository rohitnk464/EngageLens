"""
Chunking, embedding, and ChromaDB vector store service.

Handles:
1. Splitting transcripts into overlapping chunks
2. Embedding chunks using sentence-transformers (BGE-small-en-v1.5)
3. Storing/retrieving from ChromaDB with metadata filtering by video_id
"""

import logging
from typing import Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.config import get_settings
from app.models.schemas import VideoData, VideoLabel

logger = logging.getLogger(__name__)

# ─── Module-level singletons ─────────────────────────────────────────────────
_vector_store: Optional[Chroma] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Get or create the embedding model (singleton)."""
    global _embeddings
    if _embeddings is None:
        settings = get_settings()
        logger.info(f"Loading embedding model: {settings.embedding_model}")
        _embeddings = HuggingFaceEmbeddings(
            model_name=f"BAAI/bge-small-en-v1.5",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        logger.info("Embedding model loaded successfully")
    return _embeddings


def get_vector_store() -> Chroma:
    """Get or create the ChromaDB vector store (singleton)."""
    global _vector_store
    if _vector_store is None:
        settings = get_settings()
        _vector_store = Chroma(
            collection_name="video_transcripts",
            embedding_function=get_embeddings(),
            persist_directory=settings.chroma_persist_dir,
        )
        logger.info(f"ChromaDB initialized at {settings.chroma_persist_dir}")
    return _vector_store


def initialize_vector_store():
    """Initialize vector store on startup (called from FastAPI lifespan)."""
    get_vector_store()


# ─── Chunking ────────────────────────────────────────────────────────────────

def chunk_transcript(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[str]:
    """
    Split transcript text into overlapping chunks.

    Uses RecursiveCharacterTextSplitter which tries to split on
    natural boundaries (paragraphs, sentences, words) before
    falling back to character-level splits.

    Args:
        text: Full transcript text
        chunk_size: Target chunk size in characters
        chunk_overlap: Overlap between consecutive chunks

    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
    )

    chunks = splitter.split_text(text)
    logger.info(f"Split transcript into {len(chunks)} chunks (size={chunk_size}, overlap={chunk_overlap})")
    return chunks


# ─── Embed & Store ───────────────────────────────────────────────────────────

def embed_and_store(video_data: VideoData) -> int:
    """
    Chunk a video's transcript, embed it, and store in ChromaDB.

    Each chunk is tagged with metadata:
    - video_id: The video identifier (YouTube ID or Instagram shortcode)
    - video_label: "A" or "B"
    - chunk_index: Sequential index of the chunk
    - platform: "youtube" or "instagram"
    - creator: Channel/account name

    Args:
        video_data: VideoData with metadata and transcript

    Returns:
        Number of chunks stored
    """
    settings = get_settings()

    if not video_data.transcript or not video_data.transcript.strip():
        logger.warning(f"No transcript for video {video_data.metadata.video_id}, skipping embedding")
        return 0

    # Chunk the transcript
    chunks = chunk_transcript(
        video_data.transcript,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )

    if not chunks:
        return 0

    # Build LangChain Documents with metadata
    documents = []
    for i, chunk_text in enumerate(chunks):
        doc = Document(
            page_content=chunk_text,
            metadata={
                "video_id": video_data.metadata.video_id,
                "video_label": video_data.metadata.label.value,
                "chunk_index": i,
                "platform": video_data.metadata.platform.value,
                "creator": video_data.metadata.creator,
                "title": video_data.metadata.title[:200],  # Truncate for metadata limits
            },
        )
        documents.append(doc)

    # Store in ChromaDB
    store = get_vector_store()
    store.add_documents(documents)

    logger.info(
        f"Stored {len(documents)} chunks for video "
        f"{video_data.metadata.label.value} ({video_data.metadata.video_id})"
    )
    return len(documents)


# ─── Retrieval ───────────────────────────────────────────────────────────────

def get_retriever(
    video_label: Optional[str] = None,
    k: int = 5,
):
    """
    Get a ChromaDB retriever with optional metadata filtering.

    Args:
        video_label: Filter by video label ("A" or "B"). None = search all.
        k: Number of results to return.

    Returns:
        LangChain retriever
    """
    store = get_vector_store()

    search_kwargs = {"k": k}
    if video_label:
        search_kwargs["filter"] = {"video_label": video_label}

    return store.as_retriever(search_kwargs=search_kwargs)


def similarity_search(
    query: str,
    video_label: Optional[str] = None,
    k: int = 5,
) -> list[Document]:
    """
    Direct similarity search with optional video_label filter.

    Returns list of Documents with metadata.
    """
    store = get_vector_store()

    filter_dict = None
    if video_label:
        filter_dict = {"video_label": video_label}

    results = store.similarity_search_with_relevance_scores(
        query, k=k, filter=filter_dict
    )

    # Attach relevance scores to document metadata
    docs = []
    for doc, score in results:
        doc.metadata["relevance_score"] = score
        docs.append(doc)

    return docs


def clear_session_data(video_ids: list[str] = None):
    """
    Clear stored embeddings for specific videos or all data.

    Used when re-analyzing videos to avoid duplicate chunks.
    """
    store = get_vector_store()

    if video_ids:
        for vid in video_ids:
            try:
                # Use langchain-chroma delete interface
                store.delete(where={"video_id": vid})
                logger.info(f"Cleared chunks for video {vid}")
            except Exception as e:
                logger.warning(f"Error clearing data for {vid}: {e}")
    else:
        try:
            # Get all docs and delete by ids
            results = store.get()
            if results and results.get('ids'):
                store.delete(ids=results['ids'])
                logger.info(f"Cleared all chunks from vector store")
        except Exception as e:
            logger.warning(f"Error clearing vector store: {e}")
