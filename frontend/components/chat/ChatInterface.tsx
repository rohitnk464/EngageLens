'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, StopCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';
import { DeepAnalysisButton } from '@/components/analysis/DeepAnalysisButton';
import { SourceCitation } from '@/lib/types';

interface ChatInterfaceProps {
  sessionId: string;
}

const QUICK_PROMPTS = [
  'Why did Video A win?',
  'Compare the hooks',
  'What was the CTA strategy?',
  'Which video had better storytelling?',
];

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    startExternalStream,
  } = useChat(sessionId);

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // For Deep Analysis button integration
  const handleDeepAnalysisStart = () => {
    // Deep analysis calls happen via its own streamChat, injected via startExternalStream
  };

  const handleDeepToken = (token: string) => {
    // No-op — handled inside DeepAnalysisButton which manages its own stream
    // We instead wire it differently — see below
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0 flex items-center justify-between">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          EngageLens Chat
          {isStreaming && (
            <span className="text-xs text-slate-400 font-normal">Generating...</span>
          )}
        </h2>
        <button
          onClick={clearMessages}
          className="text-slate-500 hover:text-slate-300 transition p-1 rounded"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-5 p-4 max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <EmptyState onPromptClick={sendMessage} />
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                sources={msg.sources}
                isStreaming={
                  isStreaming &&
                  msg.role === 'assistant' &&
                  msg.id === messages[messages.length - 1].id
                }
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Deep Analysis Button */}
      <div className="px-4 pt-3 shrink-0">
        <DeepAnalysisButton
          sessionId={sessionId}
          onAnalysisStart={() => {
            const stream = startExternalStream(
              'Why did Video A win? Give me a full deep analysis with scores.',
            );
            return stream;
          }}
          onToken={() => {}}
          onDone={() => {}}
        />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about these videos..."
            className="min-h-[48px] max-h-32 resize-none bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500 text-sm"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stopStreaming}
              className="h-12 w-12 shrink-0 rounded-xl"
            >
              <StopCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className="h-12 w-12 shrink-0 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </form>
        <p className="text-center text-[10px] text-slate-600 mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPromptClick }: { onPromptClick: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-slate-800 flex items-center justify-center">
        <Send className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <p className="text-slate-300 font-medium mb-1">Ready to analyze</p>
        <p className="text-slate-500 text-sm">
          Ask questions about the videos, or use a quick prompt below.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPromptClick(p)}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  sources,
  isStreaming,
}: {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  isStreaming?: boolean;
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-sm'
        }`}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-current opacity-70 animate-pulse align-middle rounded-sm" />
          )}
        </div>

        {/* Source Citations */}
        {sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1.5">
              Sources
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sources.slice(0, 6).map((s, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={`text-[10px] font-mono border ${
                    s.video_label === 'A'
                      ? 'border-blue-700/50 text-blue-400 bg-blue-950/30'
                      : 'border-purple-700/50 text-purple-400 bg-purple-950/30'
                  }`}
                  title={s.chunk_text}
                >
                  Video {s.video_label} · Chunk {s.chunk_index} ·{' '}
                  {(s.relevance_score * 100).toFixed(0)}%
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
