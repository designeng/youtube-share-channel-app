/**
 * Downloaded videos on the device: <documents>/downloads/<videoId>/{video.mp4, thumb.jpg, meta.json, reviews.json}.
 * A folder without meta.json is an unfinished download. Only ids are stored, never absolute paths:
 * iOS moves the documents directory between app updates.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { DownloadFileOptions, DownloadRecord, SavedReviews } from './types';

const root = () => new Directory(Paths.document, 'downloads');
const folder = (id: string) => new Directory(root(), id);
const meta = (id: string) => new File(folder(id), 'meta.json');
const video = (id: string) => new File(folder(id), 'video.mp4');
const reviews = (id: string) => new File(folder(id), 'reviews.json');
const thumb = (id: string) => new File(folder(id), 'thumb.jpg');

export function readRecord(id: string): DownloadRecord | undefined {
  try {
    const file = meta(id);
    if (!file.exists || !video(id).exists) return undefined;
    return JSON.parse(file.textSync());
  } catch {
    return undefined;
  }
}

const folders = (): Directory[] => (root().exists ? root().list().filter((e) => e instanceof Directory) : []);

export function listRecords(): DownloadRecord[] {
  return folders()
    .map((d) => readRecord(d.name))
    .filter((r) => r !== undefined);
}

export function writeRecord(record: DownloadRecord) {
  meta(record.video.id).writeSync(JSON.stringify(record));
}

export function readReviews(id: string): SavedReviews {
  try {
    const file = reviews(id);
    return file.exists ? JSON.parse(file.textSync()) : {};
  } catch {
    return {};
  }
}

export function writeReviews(id: string, all: SavedReviews) {
  reviews(id).writeSync(JSON.stringify(all));
}

export function removeRecord(id: string) {
  const dir = folder(id);
  if (dir.exists) dir.delete();
}

/** Deletes what was left by downloads interrupted by the app being closed. */
export function removeIncomplete(keep: string[]) {
  for (const dir of folders()) if (!keep.includes(dir.name) && !readRecord(dir.name)) dir.delete();
}

/** Downloads the video file and returns its size in bytes. */
export async function downloadVideo(id: string, url: string, options: DownloadFileOptions): Promise<number> {
  folder(id).create({ intermediates: true, idempotent: true });
  const part = new File(folder(id), 'video.part');
  if (part.exists) part.delete();
  const task = File.createDownloadTask(url, part, {
    headers: options.headers,
    signal: options.signal,
    onProgress: ({ bytesWritten, totalBytes }) => options.onProgress(bytesWritten, totalBytes),
  });
  const file = await task.downloadAsync();
  if (!file?.size) throw new Error('Файл не скачался.');
  const bytes = file.size;
  if (video(id).exists) video(id).delete();
  await part.move(video(id));
  return bytes;
}

export async function downloadThumbnail(id: string, url: string) {
  await File.downloadFileAsync(url, thumb(id));
}

export const videoUri = (r: DownloadRecord) => video(r.video.id).uri;
export const thumbnailUri = (r: DownloadRecord) => (thumb(r.video.id).exists ? thumb(r.video.id).uri : r.video.thumbnail);
export const freeSpace = (): number => Paths.availableDiskSpace;
