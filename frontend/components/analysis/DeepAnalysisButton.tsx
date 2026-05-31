'use client';

import { useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { streamChat } from '@/lib/api';

const DEEP_ANALYSIS_PROMPT =
  'Why did Video A win? Give me a comprehensive deep analysis with scores out of 10 for: Hook Strength, Retention, CTA Effectiveness, Emotional Trigger, and Storytelling. Format clearly with each dimension scored for both videos.';

interface DeepAnalysisButtonProps {
  sessionId: string;
  onAnalysisStart: () => { appendToken: (t: string) => void; finish: () => void } | null;
  onToken: (token: string) => void;
  onDone: () => void;
}

export function DeepAnalysisButton({
  sessionId,
  onAnalysisStart,
}: DeepAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const stream = onAnalysisStart();
    if (!stream) {
      setIsLoading(false);
      return;
    }

    try {
      for await (const event of streamChat(DEEP_ANALYSIS_PROMPT, sessionId)) {
        if (event.type === 'token' && event.content) {
          stream.appendToken(event.content);
        } else if (event.type === 'done') {
          break;
        } else if (event.type === 'error' && event.content) {
          stream.appendToken(`\n\n⚠️ ${event.content}`);
          break;
        }
      }
    } catch (err) {
      stream.appendToken(`\n\n⚠️ Analysis error: ${(err as Error).message}`);
    } finally {
      stream.finish();
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-orange-900/20 transition-all duration-200 border-0 gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Running Deep Analysis...
        </>
      ) : (
        <>
          <Trophy className="w-4 h-4" />
          Why Did Video A Win? (Deep Analysis)
        </>
      )}
    </Button>
  );
}
