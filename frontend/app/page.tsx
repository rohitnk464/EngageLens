'use client';

import { useState } from 'react';
import { Loader2, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoCard } from '@/components/video/VideoCard';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { VideoComparison } from '@/hooks/useChat';

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoComparison | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA || !urlB) {
      setError('Please provide URLs for both videos.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const response = await fetch(`${FASTAPI_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_a_url: urlA, video_b_url: urlB }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to analyze videos.');
      }

      setSessionId(data.session_id);
      setVideoData({
        video1: data.video_a,
        video2: data.video_b,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-8 h-screen flex flex-col">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              EngageLens
            </h1>
          </div>
          <p className="text-sm text-slate-500 hidden md:block">RAG Video Analytics Engine</p>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: Input & Video Cards */}
          <div className="w-full lg:w-5/12 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide">
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur shrink-0 shadow-xl">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-blue-500" />
                  Compare Videos
                </h2>
                <form onSubmit={handleAnalyze} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Video A URL</label>
                    <input
                      type="url"
                      placeholder="YouTube or Instagram URL"
                      value={urlA}
                      onChange={(e) => setUrlA(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">Video B URL</label>
                    <input
                      type="url"
                      placeholder="YouTube or Instagram URL"
                      value={urlB}
                      onChange={(e) => setUrlB(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      required
                    />
                  </div>
                  
                  {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                  
                  <Button 
                    type="submit" 
                    disabled={isAnalyzing || !urlA || !urlB}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Transcripts & Engagement...</>
                    ) : (
                      'Analyze & Extract Data'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Video Cards Comparison */}
            {videoData && (
              <div className="flex flex-col gap-6 pb-6">
                <VideoCard meta={videoData.video1} />
                <VideoCard meta={videoData.video2} />
              </div>
            )}
          </div>

          {/* Right Column: Chat Interface */}
          <div className="w-full lg:w-7/12 h-[600px] lg:h-auto min-h-0">
            {sessionId ? (
              <ChatInterface sessionId={sessionId} />
            ) : (
              <div className="h-full rounded-xl border border-slate-800 border-dashed bg-slate-900/30 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Zap className="w-12 h-12 text-slate-700 mb-4" />
                <h3 className="text-xl font-medium text-slate-300 mb-2">Awaiting Analysis</h3>
                <p className="max-w-sm">
                  Enter two video URLs on the left and click Analyze. We'll extract transcripts, compute engagement rates, and let you chat with the data using RAG.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
