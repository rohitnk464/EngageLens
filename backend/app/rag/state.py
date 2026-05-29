"""
LangGraph state definition for the RAG workflow.
"""

from typing import Annotated, TypedDict, Optional
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class GraphState(TypedDict):
    """
    State passed between LangGraph nodes.

    messages: Conversation history (auto-appended via add_messages)
    question: Current user question
    documents_a: Retrieved chunks from Video A
    documents_b: Retrieved chunks from Video B
    metadata_context: Formatted metadata string for both videos
    generation: LLM response text
    sources: Source citations for the response
    """

    messages: Annotated[list[AnyMessage], add_messages]
    question: str
    documents_a: list[dict]
    documents_b: list[dict]
    metadata_context: str
    generation: str
    sources: list[dict]
