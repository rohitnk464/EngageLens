/**
 * Shared TypeScript types matching the FastAPI backend schemas.
 */

export type Platform = 'youtube' | 'instagram';
export type VideoLabel = 'A' | 'B';

export interface VideoMetadata {
  video_id: string;
  platform: Platform;
  label: VideoLabel;
  url: string;
  title: string;
  creator: string;
  creator_followers: number | null;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
  hashtags: string[];
  upload_date: string | null;
  duration: number | null;
  thumbnail_url: string;
  description: string;
}

export interface AnalyzeRequest {
  video_a_url: string;
  video_b_url: string;
}

export interface AnalyzeResponse {
  session_id: string;
  video_a: VideoMetadata;
  video_b: VideoMetadata;
  chunks_stored: number;
  message: string;
}

export interface ChatRequest {
  message: string;
  session_id: string;
}

export interface StreamEvent {
  type: 'token' | 'sources' | 'done' | 'error';
  content?: string;
  sources?: SourceCitation[];
}

export interface SourceCitation {
  video_label: VideoLabel;
  chunk_index: number;
  chunk_text: string;
  relevance_score: number;
}

export interface DeepAnalysisScore {
  label: string;
  scoreA: number;
  scoreB: number;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  timestamp: Date;
}
