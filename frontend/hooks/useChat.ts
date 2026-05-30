'use client';

import { useState, useCallback, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  videoComparison?: VideoComparison;
}

export interface Source {
  video_label: 'A' | 'B';
  chunk_index: number;
  chunk_text: string;
  relevance_score: number;
}

export interface VideoComparison {
  video1: VideoMeta;
  video2: VideoMeta;
}

export interface VideoMeta {
  video_id: string;
  platform: 'youtube' | 'instagram';
  label: 'A' | 'B';
  url: string;
  title: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  thumbnail_url: string;
  duration?: number;
  upload_date?: string;
}

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (userInput: string) => {
    if (!sessionId) {
      console.error("No session ID provided. Analyze videos first.");
      return;
    }

    // Abort previous stream if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Add user message immediately (optimistic)
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
    };

    // Add placeholder for assistant
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${FASTAPI_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userInput,
          session_id: sessionId,
        }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let sources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events (split on double newline)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const dataStr = event.slice(6); // Remove 'data: ' prefix
          
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            
            if (parsed.type === 'token') {
              accumulatedContent += parsed.content;
              // Update the last message with accumulated content
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: accumulatedContent,
                };
                return updated;
              });
            } else if (parsed.type === 'sources') {
              sources = parsed.sources;
            } else if (parsed.type === 'error') {
               accumulatedContent += `\n\n[Error: ${parsed.content}]`;
            }
          } catch {
            // Ignore parse errors for individual events to keep streaming robust
          }
        }
      }

      // Final update with sources
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: accumulatedContent,
          sources,
        };
        return updated;
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Stream error:', err);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: 'Sorry, an error occurred while streaming the response.',
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return { messages, isStreaming, sendMessage, stopStreaming };
}
