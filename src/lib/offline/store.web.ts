/**
 * Web counterpart of store.ts, used by the browser tests only: records live in localStorage and no file
 * is kept – the player gets the stream URL back.
 */
import type { DownloadFileOptions, DownloadRecord, SavedReviews } from './types';

const PREFIX = 'download:';
const REVIEWS = 'download-reviews:';
type Stored = DownloadRecord & { url: string };
const urls = new Map<string, string>();

export function readRecord(id: string): DownloadRecord | undefined {
  const raw = localStorage.getItem(PREFIX + id);
  return raw ? JSON.parse(raw) : undefined;
}

export function listRecords(): DownloadRecord[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => readRecord(k.slice(PREFIX.length))!);
}

export function writeRecord(record: DownloadRecord) {
  const id = record.video.id;
  const url = urls.get(id) ?? (readRecord(id) as Stored | undefined)?.url;
  localStorage.setItem(PREFIX + id, JSON.stringify({ ...record, url }));
}

export function readReviews(id: string): SavedReviews {
  return JSON.parse(localStorage.getItem(REVIEWS + id) ?? '{}');
}

export function writeReviews(id: string, all: SavedReviews) {
  localStorage.setItem(REVIEWS + id, JSON.stringify(all));
}

export function removeRecord(id: string) {
  localStorage.removeItem(REVIEWS + id);
  localStorage.removeItem(PREFIX + id);
}

export function removeIncomplete(_keep: string[]) {}

export async function downloadVideo(id: string, url: string, options: DownloadFileOptions): Promise<number> {
  const res = await fetch(url, { signal: options.signal });
  const bytes = (await res.arrayBuffer()).byteLength;
  options.onProgress(bytes, bytes);
  urls.set(id, url);
  return bytes;
}

export async function downloadThumbnail(_id: string, _url: string) {}

export const videoUri = (r: DownloadRecord) => (r as Stored).url;
export const thumbnailUri = (r: DownloadRecord) => r.video.thumbnail;
export const freeSpace = (): number => Number.MAX_SAFE_INTEGER;
