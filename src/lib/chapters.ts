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

export function segmentsFor(segments: TranscriptSegment[], ch: Chapter): TranscriptSegment[] {
  return segments.filter((s) => s.start >= ch.start - 0.5 && s.start < ch.end);
}

/** Compact transcript text with a [m:ss] marker roughly every 30s (saves tokens, keeps timecodes). */
export function transcriptToText(segments: TranscriptSegment[], everySec = 30): string {
  let out = '';
  let lastMark = -Infinity;
  for (const s of segments) {
    if (s.start - lastMark >= everySec) {
      const m = Math.floor(s.start / 60);
      const sec = String(Math.floor(s.start % 60)).padStart(2, '0');
      out += `${out ? '\n' : ''}[${m}:${sec}] `;
      lastMark = s.start;
    } else out += ' ';
    out += s.text;
  }
  return out;
}
