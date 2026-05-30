'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat, Message } from '@/hooks/useChat';
import { Badge } from '@/components/ui/badge';

interface ChatInterfaceProps {
  sessionId: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const { messages, isStreaming, sendMessage, stopStreaming } = useChat(sessionId);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          EngageLens Analysis Chat
        </h2>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 mt-20 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                <Send className="w-5 h-5 text-slate-400" />
              </div>
              <p>Ask a question about the videos, or request a deep analysis.</p>
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                <Badge variant="secondary" className="cursor-pointer hover:bg-slate-700 transition" onClick={() => sendMessage("Why did Video A win?")}>Why did Video A win?</Badge>
                <Badge variant="secondary" className="cursor-pointer hover:bg-slate-700 transition" onClick={() => sendMessage("Compare the hooks.")}>Compare the hooks</Badge>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-200 border border-slate-800'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                    {msg.content}
                    {isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1].id && (
                      <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>
                    )}
                  </div>
                  
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((s, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-slate-950/50">
                            Video {s.video_label} (Relevance: {s.relevance_score.toFixed(2)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about these videos..."
            className="min-h-[52px] h-[52px] resize-none pr-24 bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 rounded-xl focus-visible:ring-1 focus-visible:ring-blue-500"
            rows={1}
          />
          <div className="absolute right-2 top-1.5 flex gap-1">
            {isStreaming ? (
              <Button 
                type="button" 
                size="icon" 
                variant="destructive" 
                onClick={stopStreaming}
                className="h-10 w-10 rounded-lg shadow-md"
              >
                <StopCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim()}
                className="h-10 w-10 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
        <p className="text-center text-[10px] text-slate-500 mt-2">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
