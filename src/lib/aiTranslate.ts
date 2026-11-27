/**
 * Subtitle translation by the AI provider from Settings, for when YouTube's auto-translation is not available.
 * Costs the user's API quota, so it only ever runs when asked for.
 */
import { completeText, type AiConfig } from './ai';
import { transcriptLines, type TranscriptLine } from './chapters';
import { t } from './i18n';
import type { Transcript } from './types';

/** The same grouping the transcript panel shows, so timecodes survive the translation. */
const LINE_SEC = 10;
/** Small enough for the answer not to be cut off by the output limit of a free model. */
const BATCH_CHARS = 6000;
/** A model may drop or merge a few lines; those stay untranslated. Below this share the answer is unusable. */
const MIN_TRANSLATED = 0.9;

const SYSTEM = `You translate video subtitles. Every input line is "number|text".
Answer with the same lines in the same order, as "number|translation": one output line per input line.
Never merge, split, skip or renumber lines. No comments, no Markdown.
The text may come from speech recognition: keep the meaning, fix obvious recognition mistakes.`;

// Kept for the session, so reopening a video does not spend the quota again.
const cache = new Map<string, Transcript>();
const keyOf = (videoId: string, lang: string) => `${videoId}:${lang}`;

export const getTranslation = (videoId: string, lang: string) => cache.get(keyOf(videoId, lang));

function batches(lines: TranscriptLine[]) {
  const out: string[][] = [];
  let size = BATCH_CHARS;
  lines.forEach((l, i) => {
    const row = `${i + 1}|${l.text}`;
    if (size + row.length > BATCH_CHARS) {
      out.push([]);
      size = 0;
    }
    out[out.length - 1].push(row);
    size += row.length;
  });
  return out;
}

export async function translateTranscript(
  videoId: string,
  source: Transcript,
  lang: string,
  cfg: AiConfig,
  { signal, onProgress, onStatus }: { signal: AbortSignal; onProgress: (done: number, total: number) => void; onStatus: (s: string) => void },
): Promise<Transcript> {
  const lines = transcriptLines(source.segments, LINE_SEC);
  const parts = batches(lines);
  const translated = new Map<number, string>();

  for (const [i, rows] of parts.entries()) {
    onProgress(i + 1, parts.length);
    const answer = await completeText(
      cfg,
      SYSTEM,
      `Translate into the language with the code "${lang}":\n\n${rows.join('\n')}`,
      { signal, onStatus },
    );
    const wanted = new Set(rows.map((r) => parseInt(r, 10)));
    let got = 0;
    for (const line of answer.split('\n')) {
      const m = line.match(/^\s*(\d+)\s*\|\s*(.+?)\s*$/);
      if (!m || !wanted.delete(Number(m[1]))) continue;
      translated.set(Number(m[1]), m[2]);
      got++;
    }
    if (got < rows.length * MIN_TRANSLATED) throw new Error(t().transcript.badTranslation);
  }

  const last = source.segments[source.segments.length - 1];
  const end = last ? last.start + last.dur : 0;
  const result: Transcript = {
    languageCode: source.languageCode,
    translatedTo: lang,
    isAuto: source.isAuto,
    source: 'ai',
    segments: lines.map((l, i) => ({
      start: l.start,
      dur: Math.max(0, (lines[i + 1]?.start ?? end) - l.start),
      text: translated.get(i + 1) ?? l.text,
    })),
  };
  cache.set(keyOf(videoId, lang), result);
  return result;
}
