'use client';

import { VideoMetadata } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ThumbsUp, MessageCircle, Eye, Activity, PlayCircle } from 'lucide-react';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';

interface VideoCardProps {
  meta: VideoMetadata;
}

// Inline SVG icons for YouTube and Instagram (lucide-react doesn't include them)
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function VideoCard({ meta }: VideoCardProps) {
  const isYouTube = meta.platform === 'youtube';

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  const labelColor = meta.label === 'A' ? 'bg-blue-600' : 'bg-purple-600';

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-200 overflow-hidden flex flex-col shadow-lg hover:-translate-y-0.5 transition-transform duration-200">
      {/* ─── Thumbnail / Embed ── */}
      <div className="relative aspect-video w-full bg-slate-950">
        {isYouTube ? (
          <LiteYouTubeEmbed
            id={meta.video_id}
            title={meta.title}
            poster="maxresdefault"
            wrapperClass="yt-lite w-full h-full"
          />
        ) : (
          <div className="w-full h-full relative">
            {meta.thumbnail_url ? (
              <img
                src={meta.thumbnail_url}
                alt={meta.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-slate-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <InstagramIcon className="w-10 h-10 text-white/60" />
            </div>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex gap-1.5 pointer-events-none z-10">
          <Badge className={`${labelColor} hover:${labelColor} shadow-md text-xs`}>
            Video {meta.label}
          </Badge>
          <Badge
            variant="secondary"
            className="bg-slate-900/80 backdrop-blur text-slate-200 border-slate-700 text-xs"
          >
            {isYouTube ? (
              <span className="flex items-center gap-1">
                <YouTubeIcon className="w-3 h-3 text-red-400" /> YouTube
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <InstagramIcon className="w-3 h-3 text-pink-400" /> Instagram
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* ─── Title & Creator ── */}
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold leading-snug line-clamp-2" title={meta.title}>
          {meta.title || 'Untitled Video'}
        </CardTitle>
        <p className="text-xs text-slate-400 pt-1 flex items-center gap-1.5 mt-1">
          <Users className="w-3 h-3 shrink-0" />
          <span className="truncate">{meta.creator || 'Unknown Creator'}</span>
        </p>
      </CardHeader>

      {/* ─── Metrics ── */}
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/50 text-center">
            <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] uppercase font-semibold mb-0.5 tracking-wider">
              <Eye className="w-3 h-3" /> Views
            </div>
            <div className="text-lg font-bold text-slate-100">{formatNumber(meta.views)}</div>
          </div>
          <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800/50 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-400 text-[10px] uppercase font-semibold mb-0.5 tracking-wider">
              <Activity className="w-3 h-3" /> Engagement
            </div>
            <div className="text-lg font-bold text-blue-400">{meta.engagement_rate.toFixed(2)}%</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800 pt-2.5">
          <div className="flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5" />
            {formatNumber(meta.likes)}
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            {formatNumber(meta.comments)}
          </div>
          <div>{meta.upload_date ?? '—'}</div>
        </div>
      </CardContent>
    </Card>
  );
}
