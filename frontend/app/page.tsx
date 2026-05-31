'use client';

import { useState, useEffect } from 'react';
import { Loader2, Search, Zap, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoCard } from '@/components/video/VideoCard';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { analyzeVideos, checkHealth } from '@/lib/api';
import { VideoMetadata } from '@/lib/types';

export default function Home() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videoA, setVideoA] = useState<VideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<VideoMetadata | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [chunksStored, setChunksStored] = useState<number>(0);

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(setBackendOnline);
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA || !urlB) {
      setError('Please provide URLs for both videos.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setSessionId(null);
    setVideoA(null);
    setVideoB(null);

    try {
      const data = await analyzeVideos(urlA, urlB);
      setSessionId(data.session_id);
      setVideoA(data.video_a);
      setVideoB(data.video_b);
      setChunksStored(data.chunks_stored);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* Background ambient gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-blue-900/15 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-emerald-900/15 blur-[140px]" />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-8 h-screen flex flex-col">

        {/* ─── Header ─────────────────────────────────────── */}
        <header className="mb-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-tight">
                EngageLens
              </h1>
              <p className="text-[11px] text-slate-500 leading-none">RAG Video Analytics</p>
            </div>
          </div>

          {/* Backend status */}
          <div className="flex items-center gap-2">
            {backendOnline === null ? (
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Connecting...
              </span>
            ) : backendOnline ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" /> Backend online
              </span>
            ) : (
              <span className="text-xs text-red-400 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5" /> Backend offline
              </span>
            )}
            {chunksStored > 0 && (
              <span className="text-[11px] text-slate-500 border border-slate-800 rounded-full px-2 py-0.5">
                {chunksStored} chunks embedded
              </span>
            )}
          </div>
        </header>

        {/* ─── Main Layout ─────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">

          {/* Left: URL Form + Video Cards */}
          <div className="w-full lg:w-5/12 flex flex-col gap-5 overflow-y-auto pr-1">

            <Card className="bg-slate-900/70 border-slate-800 backdrop-blur shrink-0 shadow-xl">
              <CardContent className="p-5">
                <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  Compare Two Videos
                </h2>

                <form onSubmit={handleAnalyze} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Video A — Winner
                    </label>
                    <input
                      id="video-a-url"
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={urlA}
                      onChange={(e) => setUrlA(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      required
                      disabled={isAnalyzing}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Video B — Comparison
                    </label>
                    <input
                      id="video-b-url"
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={urlB}
                      onChange={(e) => setUrlB(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      required
                      disabled={isAnalyzing}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <Button
                    id="analyze-btn"
                    type="submit"
                    disabled={isAnalyzing || !urlA || !urlB}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg shadow-md shadow-blue-900/20 transition-all disabled:opacity-50 gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting Transcripts & Embedding...
                      </>
                    ) : (
                      'Analyze & Compare'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Video comparison cards */}
            {videoA && videoB && (
              <div className="flex flex-col gap-4 pb-6">
                <VideoCard meta={videoA} />
                <VideoCard meta={videoB} />
              </div>
            )}
          </div>

          {/* Right: Chat Interface */}
          <div className="w-full lg:w-7/12 min-h-0 h-[600px] lg:h-auto">
            {sessionId ? (
              <ChatInterface sessionId={sessionId} />
            ) : (
              <EmptyChat isAnalyzing={isAnalyzing} />
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

function EmptyChat({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className="h-full rounded-xl border border-slate-800 border-dashed bg-slate-900/20 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
      {isAnalyzing ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-blue-950/30 border border-blue-800/30 flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Processing Videos</h3>
          <p className="text-sm max-w-xs text-slate-500">
            Extracting transcripts, computing engagement metrics, and embedding into ChromaDB...
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Awaiting Analysis</h3>
          <p className="text-sm max-w-xs">
            Enter two video URLs and click Analyze. We will extract transcripts, embed them into ChromaDB, and unlock RAG-powered comparative chat.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left w-full max-w-xs">
            {[
              ['🎯', 'Engagement metrics'],
              ['🔍', 'Transcript RAG'],
              ['⚡', 'Streaming responses'],
              ['📝', 'Source citations'],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 text-xs text-slate-500">
                <span>{icon}</span> {label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
