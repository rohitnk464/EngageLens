'use client';

import { useState, useCallback, useRef } from 'react';
import { streamChat } from '@/lib/api';
import { ChatMessage, SourceCitation } from '@/lib/types';

export type { ChatMessage, SourceCitation };

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<boolean>(false);

  const addUserMessage = useCallback((content: string): string => {
    const id = crypto.randomUUID();
    const msg: ChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    return id;
  }, []);

  const addAssistantPlaceholder = useCallback((): string => {
    const id = crypto.randomUUID();
    const msg: ChatMessage = {
      id,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    return id;
  }, []);

  const updateLastAssistant = useCallback(
    (updater: (prev: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
          updated[lastIdx] = updater(updated[lastIdx]);
        }
        return updated;
      });
    },
    [],
  );

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!sessionId || isStreaming) return;

      abortRef.current = false;

      addUserMessage(userInput);
      addAssistantPlaceholder();
      setIsStreaming(true);

      let accumulated = '';
      let sources: SourceCitation[] = [];

      try {
        for await (const event of streamChat(userInput, sessionId)) {
          if (abortRef.current) break;

          if (event.type === 'token' && event.content) {
            accumulated += event.content;
            updateLastAssistant((msg) => ({ ...msg, content: accumulated }));
          } else if (event.type === 'sources' && event.sources) {
            sources = event.sources;
          } else if (event.type === 'error' && event.content) {
            accumulated += `\n\n⚠️ ${event.content}`;
            updateLastAssistant((msg) => ({ ...msg, content: accumulated }));
          } else if (event.type === 'done') {
            break;
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        accumulated += accumulated
          ? `\n\n⚠️ Stream error: ${errMsg}`
          : `⚠️ Failed to get response: ${errMsg}`;
        updateLastAssistant((msg) => ({ ...msg, content: accumulated }));
      } finally {
        // Attach sources on final update
        updateLastAssistant((msg) => ({ ...msg, content: accumulated, sources }));
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, addUserMessage, addAssistantPlaceholder, updateLastAssistant],
  );

  /**
   * Inject a message pair externally (used by DeepAnalysisButton).
   * Returns functions to stream into the assistant placeholder.
   */
  const startExternalStream = useCallback(
    (userContent: string) => {
      if (isStreaming) return null;
      addUserMessage(userContent);
      addAssistantPlaceholder();
      setIsStreaming(true);
      abortRef.current = false;

      let accumulated = '';

      return {
        appendToken: (token: string) => {
          accumulated += token;
          updateLastAssistant((msg) => ({ ...msg, content: accumulated }));
        },
        finish: () => {
          setIsStreaming(false);
        },
      };
    },
    [isStreaming, addUserMessage, addAssistantPlaceholder, updateLastAssistant],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    startExternalStream,
  };
}
