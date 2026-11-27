import type { Chapter, TranscriptSegment } from './types';

const TS = /(?:^|[\s(\[])((?:\d{1,2}:)?\d{1,2}:\d{2})(?=$|[\s)\]\-–—:.,|])/;

function toSeconds(ts: string): number {
  return ts.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

/**
 * Parses chapters the same way YouTube does: description lines with a timestamp.
 * YouTube requires the first one at 0:00 and at least 3 – we are a bit more lenient
 * (>= 2 timestamps, ascending) but prefer the block that starts with 0:00.
 */
export function parseChapters(description: string, durationSec?: number): Chapter[] {
  const raw: { start: number; title: string }[] = [];
  for (const line of description.split(/\r?\n/)) {
    const m = line.match(TS);
    if (!m) continue;
    const start = toSeconds(m[1]);
    const title = line
      .replace(m[1], '')
      .replace(/^[\s\-–—:.|)\]•·]+/, '')
      .replace(/[\s\-–—:|(\[]+$/, '')
      .trim();
    raw.push({ start, title: title || `Глава ${raw.length + 1}` });
  }
  // Take the first ascending run that starts at 0:00 (or the longest ascending run).
  let best: typeof raw = [];
  for (let i = 0; i < raw.length; i++) {
    const run = [raw[i]];
    for (let j = i + 1; j < raw.length && raw[j].start > run[run.length - 1].start; j++) run.push(raw[j]);
    const score = (r: typeof raw) => r.length + (r[0]?.start === 0 ? 1000 : 0);
    if (score(run) > score(best)) best = run;
  }
  if (best.length < 2) return [];
  if (durationSec) best = best.filter((c) => c.start < durationSec);
  return best.map((c, i) => ({
    index: i,
    title: c.title,
    start: c.start,
    end: best[i + 1]?.start ?? durationSec ?? Infinity,
  }));
}

/** Splits a video without chapters into equal parts (~10 min) so AI reviews stay detailed. */
export function autoParts(durationSec: number, partMin = 10): Chapter[] {
  const size = partMin * 60;
  const n = Math.max(1, Math.round(durationSec / size));
  const len = durationSec / n;
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    title: n === 1 ? 'Всё видео' : `Часть ${i + 1}`,
    start: Math.round(i * len),
    end: i === n - 1 ? durationSec : Math.round((i + 1) * len),
  }));
}

/** What the video screen shows and AI reviews are made for: the author's chapters, else equal parts. */
export function videoParts({ description, durationSec }: { description: string; durationSec?: number }) {
  const chapters = parseChapters(description, durationSec);
  const authored = chapters.length > 0;
  return { authored, parts: authored ? chapters : durationSec ? autoParts(durationSec) : [] };
}

export function segmentsFor(segments: TranscriptSegment[], ch: Chapter): TranscriptSegment[] {
  return segments.filter((s) => s.start >= ch.start - 0.5 && s.start < ch.end);
}

export type TranscriptLine = { start: number; text: string };

/** Groups caption segments into lines that each span at least `everySec` seconds. */
export function transcriptLines(segments: TranscriptSegment[], everySec: number): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const s of segments) {
    const last = lines[lines.length - 1];
    if (!last || s.start - last.start >= everySec) lines.push({ start: s.start, text: s.text });
    else last.text += ` ${s.text}`;
  }
  return lines;
}

/** Index of the line being spoken at `time`, -1 before the first one. */
export function lineIndexAt(lines: TranscriptLine[], time: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    // Half a second of slack: the player may land slightly before the requested time after a seek.
    if (lines[mid].start <= time + 0.5) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Compact transcript text with a [m:ss] marker roughly every 30s (saves tokens, keeps timecodes). */
export function transcriptToText(segments: TranscriptSegment[], everySec = 30): string {
  return transcriptLines(segments, everySec)
    .map((l) => {
      const m = Math.floor(l.start / 60);
      const sec = String(Math.floor(l.start % 60)).padStart(2, '0');
      return `[${m}:${sec}] ${l.text}`;
    })
    .join('\n');
}
