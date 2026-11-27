import type { Transcript, VideoDetails } from '../types';

/** Languages offered for offline transcripts. */
export const OFFLINE_LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

/** Everything needed to work with a video without a network. Written only when the download is complete. */
export type DownloadRecord = {
  /** has the description, so timecodes (chapters) are available offline */
  video: VideoDetails;
  bytes: number;
  quality: string;
  savedAt: string; // ISO
  transcripts: Transcript[];
  /** requested languages that could not be saved (YouTube often rate-limits auto-translation) */
  missingLangs: string[];
};

/** AI reviews kept with a downloaded video, by target: a part index or 'all'. */
export type SavedReviews = Record<string, string>;

export type DownloadFileOptions = {
  headers: Record<string, string>;
  signal: AbortSignal;
  onProgress: (written: number, total: number) => void;
};
