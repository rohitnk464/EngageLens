'use client';

import { VideoMeta } from '@/hooks/useChat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Youtube, Instagram, Users, ThumbsUp, MessageCircle, Eye, Activity } from 'lucide-react';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';

interface VideoCardProps {
  meta: VideoMeta;
}

export function VideoCard({ meta }: VideoCardProps) {
  const isYouTube = meta.platform === 'youtube';

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-200 overflow-hidden flex flex-col h-full shadow-lg transition-transform hover:-translate-y-1 duration-300">
      {/* Media Header */}
      <div className="relative aspect-video w-full bg-slate-950">
        {isYouTube ? (
          <LiteYouTubeEmbed
            id={meta.video_id}
            title={meta.title}
            poster="maxresdefault"
            wrapperClass="yt-lite"
          />
        ) : (
          <div className="w-full h-full relative">
            <img 
              src={meta.thumbnail_url || 'https://via.placeholder.com/640x360?text=Instagram+Reel'} 
              alt={meta.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <Instagram className="w-12 h-12 text-white/70" />
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-2 pointer-events-none z-10">
          <Badge className="bg-blue-600 hover:bg-blue-600 shadow-md">
            Video {meta.label}
          </Badge>
          <Badge variant="secondary" className="bg-slate-900/80 backdrop-blur shadow-md text-slate-200 border-slate-700">
            {isYouTube ? (
              <span className="flex items-center gap-1"><Youtube className="w-3 h-3 text-red-500" /> YouTube</span>
            ) : (
              <span className="flex items-center gap-1"><Instagram className="w-3 h-3 text-pink-500" /> Instagram</span>
            )}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardHeader className="pb-2">
        <CardTitle className="text-lg leading-tight line-clamp-2" title={meta.title}>
          {meta.title || "Untitled Video"}
        </CardTitle>
        <p className="text-sm text-slate-400 font-medium pt-1 flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
            <Users className="w-3 h-3 text-slate-300" />
          </span>
          <span className="truncate">{meta.creator || "Unknown Creator"}</span>
        </p>
      </CardHeader>

      <CardContent className="mt-auto">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/50 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs uppercase font-semibold mb-1 tracking-wider">
              <Eye className="w-3.5 h-3.5" /> Views
            </div>
            <div className="text-xl font-bold text-slate-100">{formatNumber(meta.views)}</div>
          </div>
          
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800/50 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 text-blue-400 text-xs uppercase font-semibold mb-1 tracking-wider">
              <Activity className="w-3.5 h-3.5" /> Engagement
            </div>
            <div className="text-xl font-bold text-blue-400">{meta.engagement_rate.toFixed(2)}%</div>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-slate-400 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="w-4 h-4" /> 
            <span>{formatNumber(meta.likes)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> 
            <span>{formatNumber(meta.comments)}</span>
          </div>
          <div className="text-xs">
            {meta.upload_date || "Unknown Date"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
