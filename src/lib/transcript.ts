/**
 * Transcript fetching via YouTube's internal (InnerTube) endpoints.
 *
 * IMPORTANT: the official YouTube Data API (captions.download) only lets the
 * *owner* of a video download captions (OAuth). For arbitrary videos the only
 * option is the same private endpoints the YouTube website/app use. They are
 * undocumented, may change without notice and are a grey area of YouTube ToS.
 * Strategy (each step is a fallback for the previous):
 *   1. /youtubei/v1/player with a mobile client -> captionTracks -> timedtext (json3),
 *      `tlang` gives a machine translation into any of `translationLanguages`.
 *   2. Watch page HTML -> ytInitialPlayerResponse -> same timedtext URLs.
 *   3. /youtubei/v1/get_transcript (the "Show transcript" panel) – default track only.
 */
import type { CaptionTrack, Transcript, TranscriptInfo, TranscriptSegment } from './types';

const YT = 'https://www.youtube.com';

// Client identities. Versions occasionally need bumping when YouTube rejects old ones.
const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 30,
  osName: 'Android',
  osVersion: '11',
};
const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';
const WEB_CLIENT = { clientName: 'WEB', clientVersion: '2.20251101.00.00' };
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

type PlayerCaptions = {
  captionTracks?: any[];
  translationLanguages?: any[];
};

function textOf(node: any): string {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r: any) => r.text ?? '').join('');
  return '';
}

function toInfo(c: PlayerCaptions | undefined): TranscriptInfo {
  const tracks: CaptionTrack[] = (c?.captionTracks ?? []).map((t: any) => ({
    languageCode: t.languageCode,
    name: textOf(t.name) || t.languageCode,
    isAuto: t.kind === 'asr',
    isTranslatable: !!t.isTranslatable,
    baseUrl: t.baseUrl,
  }));
  const translationLanguages = (c?.translationLanguages ?? []).map((l: any) => ({
    languageCode: l.languageCode,
    name: textOf(l.languageName) || l.languageCode,
  }));
  return { tracks, translationLanguages };
}

async function playerViaAndroid(videoId: string, hl: string): Promise<PlayerCaptions | undefined> {
  const res = await fetch(`${YT}/youtubei/v1/player?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': ANDROID_UA,
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': ANDROID_CLIENT.clientVersion,
    },
    body: JSON.stringify({
      context: { client: { ...ANDROID_CLIENT, hl, gl: 'US' } },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!res.ok) return undefined;
  const json = await res.json();
  return json?.captions?.playerCaptionsTracklistRenderer;
}

async function fetchWatchHtml(videoId: string, hl: string): Promise<string> {
  const res = await fetch(`${YT}/watch?v=${encodeURIComponent(videoId)}&hl=${hl}`, {
    headers: { 'User-Agent': WEB_UA, 'Accept-Language': hl, Cookie: 'CONSENT=YES+1' },
  });
  return res.text();
}

function extractJsonAfter(html: string, marker: string): any | undefined {
  const i = html.indexOf(marker);
  if (i < 0) return undefined;
  const start = html.indexOf('{', i);
  if (start < 0) return undefined;
  // Walk braces respecting strings to find the end of the JSON object.
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, j + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

let cache = new Map<string, { info: TranscriptInfo; html?: string }>();

/** Lists available caption tracks + languages YouTube can auto-translate into. */
export async function getTranscriptInfo(videoId: string, hl = 'en'): Promise<TranscriptInfo> {
  const cached = cache.get(videoId);
  if (cached) return cached.info;

  let info: TranscriptInfo = { tracks: [], translationLanguages: [] };
  try {
    info = toInfo(await playerViaAndroid(videoId, hl));
  } catch {}
  let html: string | undefined;
  if (!info.tracks.length) {
    try {
      html = await fetchWatchHtml(videoId, hl);
      const pr = extractJsonAfter(html, 'ytInitialPlayerResponse');
      info = toInfo(pr?.captions?.playerCaptionsTracklistRenderer);
    } catch {}
  }
  cache.set(videoId, { info, html });
  return info;
}

function parseJson3(json: any): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const ev of json?.events ?? []) {
    if (!ev.segs) continue;
    const text = ev.segs
      .map((s: any) => s.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    out.push({ start: (ev.tStartMs ?? 0) / 1000, dur: (ev.dDurationMs ?? 0) / 1000, text });
  }
  return out;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseXml(xml: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  // srv1: <text start="1.2" dur="3.4">..</text>; srv3: <p t="1200" d="3400">..</p>
  const re1 = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  const re3 = /<p t="(\d+)"(?: d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(xml)))
    out.push({ start: +m[1], dur: +(m[2] ?? 0), text: decodeEntities(m[3].replace(/<[^>]+>/g, '')).trim() });
  if (!out.length)
    while ((m = re3.exec(xml)))
      out.push({ start: +m[1] / 1000, dur: +(m[2] ?? 0) / 1000, text: decodeEntities(m[3].replace(/<[^>]+>/g, '')).trim() });
  return out.filter((s) => s.text);
}

async function fetchTimedText(baseUrl: string, tlang?: string): Promise<TranscriptSegment[]> {
  const url = new URL(baseUrl.startsWith('http') ? baseUrl : YT + baseUrl);
  url.searchParams.set('fmt', 'json3');
  if (tlang) url.searchParams.set('tlang', tlang);
  const res = await fetch(url.toString(), { headers: { 'User-Agent': ANDROID_UA } });
  const body = await res.text();
  if (!body) return [];
  if (body.trimStart().startsWith('{')) return parseJson3(JSON.parse(body));
  return parseXml(body);
}

async function viaGetTranscript(videoId: string, hl: string): Promise<TranscriptSegment[]> {
  let html = cache.get(videoId)?.html;
  if (!html) html = await fetchWatchHtml(videoId, hl);
  const m = html.match(/"getTranscriptEndpoint":\{"params":"([^"]+)"/);
  if (!m) return [];
  const res = await fetch(`${YT}/youtubei/v1/get_transcript?prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': WEB_UA },
    body: JSON.stringify({ context: { client: { ...WEB_CLIENT, hl } }, params: m[1] }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const segs =
    json?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content
      ?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments ?? [];
  const out: TranscriptSegment[] = [];
  for (const s of segs) {
    const r = s.transcriptSegmentRenderer;
    if (!r) continue;
    const start = Number(r.startMs) / 1000;
    const end = Number(r.endMs) / 1000;
    const text = textOf(r.snippet).trim();
    if (text) out.push({ start, dur: end - start, text });
  }
  return out;
}

/**
 * Picks the best track for `preferredLang`:
 *   exact manual track > exact auto track > any track translated to preferredLang > first track.
 */
export function pickTrack(info: TranscriptInfo, preferredLang: string) {
  const base = (c: string) => c.toLowerCase().split('-')[0];
  const want = base(preferredLang);
  const manual = info.tracks.find((t) => base(t.languageCode) === want && !t.isAuto);
  if (manual) return { track: manual };
  const auto = info.tracks.find((t) => base(t.languageCode) === want);
  if (auto) return { track: auto };
  const canTranslate = info.translationLanguages.some((l) => base(l.languageCode) === want);
  const source = info.tracks.find((t) => !t.isAuto && t.isTranslatable) ?? info.tracks.find((t) => t.isTranslatable);
  if (source && canTranslate) return { track: source, tlang: preferredLang };
  return { track: info.tracks[0] };
}

export async function getTranscript(
  videoId: string,
  opts: { languageCode?: string; tlang?: string; hl?: string } = {},
): Promise<Transcript> {
  const hl = opts.hl ?? 'en';
  const info = await getTranscriptInfo(videoId, hl);
  let track = info.tracks.find((t) => t.languageCode === opts.languageCode) ?? info.tracks[0];
  let tlang = opts.tlang;
  if (!opts.languageCode && opts.tlang) {
    const picked = pickTrack(info, opts.tlang);
    track = picked.track;
    tlang = picked.tlang;
  }
  if (track?.baseUrl) {
    try {
      const segments = await fetchTimedText(track.baseUrl, tlang);
      if (segments.length)
        return { languageCode: track.languageCode, translatedTo: tlang, isAuto: track.isAuto, segments, source: 'timedtext' };
    } catch {}
    // Machine translation (tlang) is aggressively rate-limited (HTTP 429) – fall back to the original track.
    if (tlang) {
      try {
        const segments = await fetchTimedText(track.baseUrl);
        if (segments.length)
          return {
            languageCode: track.languageCode,
            isAuto: track.isAuto,
            segments,
            source: 'timedtext',
            translationFailed: true,
          };
      } catch {}
    }
  }
  const segments = await viaGetTranscript(videoId, hl);
  if (segments.length)
    return { languageCode: track?.languageCode ?? 'und', isAuto: track?.isAuto ?? false, segments, source: 'get_transcript' };
  throw new Error(
    info.tracks.length
      ? 'YouTube отказал в выдаче субтитров (возможно, изменился внутренний API).'
      : 'У этого видео нет субтитров.',
  );
}

export function clearTranscriptCache() {
  cache = new Map();
}
