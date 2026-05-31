# EngageLens 🔍⚡

**AI-powered video comparison platform** that lets social media creators ask questions about two videos using Retrieval-Augmented Generation (RAG). Paste two YouTube or Instagram Reel URLs, and EngageLens extracts transcripts, computes engagement metrics, embeds the content into a vector database, and gives you a streaming chat interface to compare the videos intelligently.

> Built as a full-stack RAG engineering challenge demonstrating LangGraph orchestration, ChromaDB vector retrieval, SSE streaming, and modern Next.js architecture.

---

## ✨ Features

- **Dual Video Analysis** — Compare two YouTube or Instagram Reels side-by-side
- **Engagement Metrics** — Automatically computes engagement rate, extracts views/likes/comments
- **RAG Chat** — Ask questions grounded in transcript content with source citations
- **Streaming Responses** — GPT-4o-mini responses stream token-by-token via Server-Sent Events
- **Conversation Memory** — LangGraph's MemorySaver checkpointer maintains context across turns
- **"Why Video A Won?" Deep Analysis** — One-click comprehensive breakdown with Hook, Retention, CTA, Emotional Trigger, and Storytelling scores
- **Multi-Platform** — YouTube (free transcripts via `youtube-transcript-api`) + Instagram Reels (audio → Whisper)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  [Video A Card] [Video B Card]  [Chat Interface + SSE]  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                          │
│  POST /api/analyze ──► Data Pipeline                     │
│  POST /api/chat    ──► LangGraph Workflow ──► SSE stream │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           LangGraph StateGraph                    │   │
│  │  START → retrieve(A+B) → generate → END          │   │
│  │          ↕ MemorySaver (per session_id)          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Data Pipeline                                    │   │
│  │  YouTube  → youtube-transcript-api (free)         │   │
│  │  Instagram → yt-dlp download + OpenAI Whisper     │   │
│  │  Metadata → yt-dlp --dump-json                   │   │
│  └──────────────────────────┬───────────────────────┘   │
│                             │                            │
│  ┌──────────────────────────▼───────────────────────┐   │
│  │  ChromaDB (local, persistent)                    │   │
│  │  Collection: video_transcripts                   │   │
│  │  Embedding: BAAI/bge-small-en-v1.5 (local, free)│   │
│  │  Filter by: { video_label: "A" | "B" }          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 15 + TypeScript | App Router, SSE support, type safety |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Premium dark design system |
| **Backend** | FastAPI (Python) | Async-native, auto-docs, SSE support |
| **Orchestration** | LangGraph | Stateful graph, MemorySaver, astream |
| **LLM** | GPT-4o-mini | 60x cheaper than GPT-4o, 128K context |
| **Embeddings** | BAAI/bge-small-en-v1.5 | Free, local, high quality for English |
| **Vector DB** | ChromaDB (persistent) | Free, metadata filtering, LangChain support |
| **Transcripts** | youtube-transcript-api | Free YouTube transcripts (no API key) |
| **Media** | yt-dlp | Metadata + audio extraction |
| **Instagram audio** | OpenAI Whisper API | Accurate speech-to-text for Reels |

---

## 🚀 Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- `yt-dlp` installed: `pip install yt-dlp`
- An OpenAI API key

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate       # Windows
# source venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run the server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`  
API docs (Swagger): `http://localhost:8000/docs`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run the dev server
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## 📡 API Reference

### `POST /api/analyze`

Ingests two videos — extracts transcripts, computes engagement, embeds into ChromaDB.

**Request:**
```json
{
  "video_a_url": "https://youtube.com/watch?v=...",
  "video_b_url": "https://youtube.com/watch?v=..."
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "video_a": { "title": "...", "views": 1200000, "engagement_rate": 4.2, ... },
  "video_b": { "title": "...", "views": 300000, "engagement_rate": 1.8, ... },
  "chunks_stored": 84,
  "message": "Successfully analyzed both videos. 84 transcript chunks embedded."
}
```

### `POST /api/chat`

Streams a RAG response via Server-Sent Events.

**Request:**
```json
{
  "message": "Why did Video A get more engagement?",
  "session_id": "uuid"
}
```

**Response (SSE stream):**
```
data: {"type": "token", "content": "Video A"}
data: {"type": "token", "content": " outperformed"}
...
data: {"type": "sources", "sources": [...]}
data: {"type": "done"}
data: [DONE]
```

---

## 💡 Engineering Decisions

### Why LangGraph over basic LangChain?

LangGraph gives us a **stateful graph** with:
- **MemorySaver checkpointer** — conversation memory per `thread_id` (session_id)
- **Streaming first-class** — token-by-token via `astream`
- **Extensible nodes** — easy to add routing, grading, or tool use nodes later
- **Production standard** — recommended by the LangChain team for agentic workflows

### Why ChromaDB?

- **Zero cost** — fully local, no API keys
- **Persistent** — survives server restarts (saved to disk)
- **Metadata filtering** — filter by `video_label: "A"` or `"B"` for scoped retrieval
- **At scale**: migrate to Qdrant Cloud or pgvector for horizontal scaling

### Why BGE-small-en-v1.5?

- **Free** — runs locally on CPU, no embedding API costs
- **Fast** — 384-dim vectors, <50ms encode time
- **High quality** — MTEB top performer for retrieval tasks
- **Alternative**: OpenAI `text-embedding-3-small` at $0.02/1M tokens

### Why GPT-4o-mini?

- **$0.15/$0.60 per 1M tokens** — 60x cheaper than GPT-4o
- **128K context** — fits entire transcripts easily
- **Quality sufficient** — RAG comparison tasks don't need frontier reasoning

---

## 💰 Cost Analysis (1,000 creators/day)

| Component | Cost/creator | Daily | Monthly |
|-----------|-------------|-------|---------|
| GPT-4o-mini (LLM) | ~$0.001 | $1.00 | $30 |
| BGE embeddings | Free | $0 | $0 |
| ChromaDB | Free | $0 | $0 |
| YouTube transcripts | Free | $0 | $0 |
| Whisper API (Instagram, 5min avg) | ~$0.03 | $30 | $900 |
| Server (2 vCPU, 8GB RAM) | — | — | $40 |
| **Total** | **~$0.031** | **~$31** | **~$970** |

**Key optimization**: Use local Whisper (`faster-whisper`) to drop Whisper cost to $0 → **$30/month total at 1,000 creators/day**.

---

## 🗂️ Project Structure

```
fullstack/
├── backend/
│   ├── app/
│   │   ├── config.py           # Pydantic settings from .env
│   │   ├── main.py             # FastAPI app + CORS + lifespan
│   │   ├── models/schemas.py   # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── analyze.py      # POST /api/analyze
│   │   │   └── chat.py         # POST /api/chat (SSE)
│   │   ├── services/
│   │   │   ├── youtube.py      # YouTube transcript + metadata
│   │   │   ├── instagram.py    # Instagram Reel pipeline
│   │   │   ├── transcript.py   # Platform auto-detection
│   │   │   ├── embeddings.py   # ChromaDB + BGE chunking/embedding
│   │   │   └── metadata.py     # Engagement rate computation
│   │   └── rag/
│   │       ├── graph.py        # LangGraph StateGraph + streaming
│   │       ├── nodes.py        # Retrieve + Generate nodes
│   │       ├── state.py        # GraphState TypedDict
│   │       └── prompts.py      # System + generation prompts
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main dual-panel layout
│   │   ├── layout.tsx          # Root layout + dark mode
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── chat/ChatInterface.tsx    # Streaming chat UI
│   │   ├── video/VideoCard.tsx       # Video metadata card
│   │   └── analysis/DeepAnalysisButton.tsx  # "Why Video A Won"
│   ├── hooks/useChat.ts        # SSE streaming hook
│   └── lib/
│       ├── api.ts              # Typed API client
│       └── types.ts            # TypeScript interfaces
└── README.md
```

---

## 🧪 Sample Questions to Test

After analyzing two videos, try asking:

- **"Why did Video A get more engagement than Video B?"**
- **"Compare the hooks in the first 10 seconds of both videos"**
- **"What's the engagement rate of each video?"**
- **"What CTA did each creator use?"**
- **"Suggest 3 improvements Video B could learn from Video A"**
- Click **"Why Did Video A Win?"** for a structured deep analysis with scores

---

## 📋 Day-by-Day Progress

| Day | Focus | Status |
|-----|-------|--------|
| Day 1 | Backend: Data Pipeline + ChromaDB + LangGraph RAG | ✅ Done |
| Day 2 | Frontend: Next.js + shadcn/ui + SSE Chat UI | ✅ Done |
| Day 3 | Integration: Types, API client, DeepAnalysis, README | ✅ Done |
| Day 4 | Testing, Error Handling, Performance Polish | 🚧 Upcoming |
| Day 5 | Demo Prep, Deployment Docs, Final Review | 🚧 Upcoming |
