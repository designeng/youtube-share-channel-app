export type ChannelInfo = {
  id: string;
  title: string;
  handle?: string;
  description?: string;
  thumbnail?: string;
  uploadsPlaylistId: string;
  videoCount?: number;
};

export type VideoItem = {
  id: string;
  title: string;
  publishedAt: string; // ISO
  thumbnail?: string;
  durationSec?: number;
  viewCount?: number;
};

export type VideoDetails = VideoItem & {
  description: string;
  channelId: string;
  channelTitle: string;
  likeCount?: number;
  defaultAudioLanguage?: string;
};

export type Chapter = {
  index: number;
  title: string;
  start: number; // seconds
  end: number; // seconds (exclusive), Infinity if unknown
};

export type TranscriptSegment = {
  start: number; // seconds
  dur: number; // seconds
  text: string;
};

export type CaptionTrack = {
  languageCode: string;
  name: string;
  isAuto: boolean; // auto-generated (ASR)
  isTranslatable: boolean;
  baseUrl?: string;
};

export type TranscriptInfo = {
  tracks: CaptionTrack[];
  translationLanguages: { languageCode: string; name: string }[];
};

export type Transcript = {
  languageCode: string;
  translatedTo?: string;
  isAuto: boolean;
  segments: TranscriptSegment[];
  source: 'timedtext' | 'get_transcript';
  /** Requested YouTube auto-translation failed (usually HTTP 429); original language returned. */
  translationFailed?: boolean;
};
