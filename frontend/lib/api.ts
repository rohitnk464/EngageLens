/**
 * Typed API client for the EngageLens FastAPI backend.
 *
 * Handles:
 * - POST /api/analyze  — video ingestion
 * - POST /api/chat     — SSE streaming responses
 */

import { AnalyzeRequest, AnalyzeResponse, StreamEvent } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Analyze two video URLs — extracts transcripts, computes engagement,
 * embeds into ChromaDB. Returns metadata and a session_id.
 */
export async function analyzeVideos(
  videoAUrl: string,
  videoBUrl: string,
): Promise<AnalyzeResponse> {
  const payload: AnalyzeRequest = {
    video_a_url: videoAUrl,
    video_b_url: videoBUrl,
  };

  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Stream a chat response from the RAG backend.
 *
 * Returns an async generator that yields StreamEvents.
 * Consumers should iterate with `for await (const event of streamChat(...))`
 */
export async function* streamChat(
  message: string,
  sessionId: string,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Chat API error: ${response.status}`);
  }

  if (!response.body) throw new Error('No response body from chat API');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE: split on double newline
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const raw = part.slice(6).trim();
        if (raw === '[DONE]') return;

        try {
          const event: StreamEvent = JSON.parse(raw);
          yield event;
        } catch {
          // Ignore malformed events
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

/** Check backend health */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
