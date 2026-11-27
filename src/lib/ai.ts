import { segmentsFor, transcriptToText } from './chapters';
import { t } from './i18n';
import { promptsFor } from './prompts';
import type { Chapter, Transcript, VideoDetails } from './types';

export type AiProvider = 'gemini' | 'openrouter';

export type AiConfig = {
  provider: AiProvider;
  geminiKey: string;
  geminiModel: string;
  openrouterKey: string;
  openrouterModel: string;
  outputLanguage: string; // human readable, e.g. "русский"
};

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export type ReviewInput = {
  video: VideoDetails;
  chapters: Chapter[];
  transcript?: Transcript;
  /** chapter index, or 'all' for a single whole-video overview */
  target: number | 'all';
};

type Part = { text: string } | { fileData: { fileUri: string }; videoMetadata?: { startOffset: string; endOffset: string } };

function buildPrompt({ video, chapters, transcript, target }: ReviewInput, cfg: AiConfig) {
  const prompts = promptsFor(cfg.outputLanguage);
  const ch = target === 'all' ? undefined : chapters[target];
  const task = ch ? prompts.chapterTask(video, ch, chapters.length) : prompts.overviewTask(video, chapters);
  let transcriptText: string | undefined;
  if (transcript) {
    const segs = ch ? segmentsFor(transcript.segments, ch) : transcript.segments;
    transcriptText = transcriptToText(segs);
  }
  return { prompts, system: prompts.system(cfg.outputLanguage), task, transcriptText, chapter: ch };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, onWait?: (sec: number) => void): Promise<T> {
  // Free tiers have low RPM limits: retry 429/503 with backoff.
  const delays = [8, 20, 45];
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i >= delays.length || !(e?.status === 429 || e?.status === 503)) throw e;
      const wait = e.retryAfter ?? delays[i];
      onWait?.(wait);
      await sleep(wait * 1000);
    }
  }
}

class AiError extends Error {
  constructor(message: string, public status?: number, public retryAfter?: number) {
    super(message);
  }
}

async function gemini(cfg: AiConfig, system: string, parts: Part[]): Promise<string> {
  if (!cfg.geminiKey) throw new AiError(t().ai.noGeminiKey);
  const model = cfg.geminiModel.replace(/^models\//, '');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.geminiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const retry = json?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
    throw new AiError(json?.error?.message ?? `Gemini: HTTP ${res.status}`, res.status, retry ? parseInt(retry, 10) : undefined);
  }
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!text) throw new AiError(t().ai.geminiEmpty(json?.candidates?.[0]?.finishReason ?? 'unknown'));
  return text;
}

async function openrouter(cfg: AiConfig, system: string, user: string): Promise<string> {
  if (!cfg.openrouterKey) throw new AiError(t().ai.noOpenRouterKey);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.openrouterKey}`,
      'X-Title': 'Channel Viewer',
    },
    body: JSON.stringify({
      model: cfg.openrouterModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const status = json?.error?.code ?? res.status;
    throw new AiError(json?.error?.message ?? `OpenRouter: HTTP ${res.status}`, typeof status === 'number' ? status : res.status);
  }
  const text = json?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new AiError(t().ai.openRouterEmpty);
  return text;
}

/**
 * Generates a detailed review for one chapter or the whole video.
 * Without a transcript, Gemini can watch the YouTube video itself (public videos only),
 * clipped to the chapter via videoMetadata offsets. OpenRouter needs a transcript.
 */
export async function generateReview(
  input: ReviewInput,
  cfg: AiConfig,
  onStatus?: (s: string) => void,
): Promise<string> {
  const { prompts, system, task, transcriptText, chapter } = buildPrompt(input, cfg);
  const onWait = (sec: number) => onStatus?.(t().ai.rateLimited(sec));

  if (cfg.provider === 'gemini') {
    const parts: Part[] = [];
    if (transcriptText) {
      parts.push({ text: `${task}\n\n${prompts.transcriptIntro}\n${transcriptText}` });
    } else {
      const video: Part = { fileData: { fileUri: `https://www.youtube.com/watch?v=${input.video.id}` } };
      if (chapter && isFinite(chapter.end))
        (video as any).videoMetadata = { startOffset: `${chapter.start}s`, endOffset: `${Math.ceil(chapter.end)}s` };
      parts.push(video, { text: `${task}\n\n${prompts.noTranscript(!!chapter)}` });
    }
    return withRetry(() => gemini(cfg, system, parts), onWait);
  }

  if (!transcriptText)
    throw new AiError(t().ai.needsTranscript);
  return withRetry(
    () => openrouter(cfg, system, `${task}\n\n${prompts.transcriptIntro}\n${transcriptText}`),
    onWait,
  );
}

export type ModelOption = { id: string; label: string };

export async function listGeminiModels(key: string): Promise<ModelOption[]> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return (json.models ?? [])
    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
    .map((m: any) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
}

export async function listOpenRouterFreeModels(): Promise<ModelOption[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const json = await res.json();
  return (json.data ?? [])
    .filter(
      (m: any) =>
        m.pricing?.prompt === '0' &&
        m.pricing?.completion === '0' &&
        (m.architecture?.output_modalities ?? ['text']).includes('text') &&
        (m.architecture?.input_modalities ?? ['text']).includes('text'),
    )
    .sort((a: any, b: any) => (b.context_length ?? 0) - (a.context_length ?? 0))
    .map((m: any) => ({ id: m.id, label: `${m.name ?? m.id} · ${Math.round((m.context_length ?? 0) / 1000)}k` }));
}
