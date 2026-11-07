import { formatTime } from './format';
import { segmentsFor, transcriptToText } from './chapters';
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

const SYSTEM_PROMPT = (lang: string) => `Ты — внимательный аналитик видеоконтента. Твоя задача — ПОДРОБНЫЙ обзор, а не короткое резюме.
Правила:
- Пиши на языке: ${lang}, даже если транскрипт на другом языке.
- Сохраняй конкретику: факты, цифры, имена, термины, аргументы, примеры, шаги, рецепты, код, выводы автора.
- Передавай логику рассуждения автора: что утверждается, почему, на каких примерах.
- Указывай таймкоды в формате [м:сс] для ключевых моментов (бери их из меток транскрипта).
- Ничего не выдумывай. Если в транскрипте что-то неразборчиво (автосубтитры) — так и скажи.
- Не используй вступлений вроде "В этом видео...". Сразу к сути.
- Формат — Markdown: заголовки ###, списки, **жирный** для ключевых терминов.`;

const CHAPTER_TASK = (video: VideoDetails, ch: Chapter, total: number) => `Видео: «${video.title}» (канал ${video.channelTitle}).
Глава ${ch.index + 1} из ${total}: «${ch.title}» [${formatTime(ch.start)}–${formatTime(ch.end)}].

Сделай подробный обзор ЭТОЙ главы:
### Суть
1–2 предложения: о чём глава и главный тезис.
### Подробно
Развёрнутый пересказ по пунктам в порядке изложения, с аргументами, примерами и таймкодами.
### Факты, цифры, цитаты
Всё конкретное, что стоит запомнить.
### Выводы
Что из этого следует / практические рекомендации (если есть).`;

const OVERVIEW_TASK = (video: VideoDetails, chapters: Chapter[]) => `Видео: «${video.title}» (канал ${video.channelTitle}, длительность ${formatTime(video.durationSec ?? 0)}).
Главы:
${chapters.map((c) => `${c.index + 1}. [${formatTime(c.start)}] ${c.title}`).join('\n')}

Сделай подробный обзор всего видео:
### Главная мысль
### По главам
Для КАЖДОЙ главы — заголовок "**N. Название [м:сс]**" и 4–8 содержательных пунктов.
### Ключевые факты и цифры
### Итог и практическая ценность`;

export type ReviewInput = {
  video: VideoDetails;
  chapters: Chapter[];
  transcript?: Transcript;
  /** chapter index, or 'all' for a single whole-video overview */
  target: number | 'all';
};

type Part = { text: string } | { fileData: { fileUri: string }; videoMetadata?: { startOffset: string; endOffset: string } };

function buildPrompt({ video, chapters, transcript, target }: ReviewInput, cfg: AiConfig) {
  const ch = target === 'all' ? undefined : chapters[target];
  const task = ch ? CHAPTER_TASK(video, ch, chapters.length) : OVERVIEW_TASK(video, chapters);
  let transcriptText: string | undefined;
  if (transcript) {
    const segs = ch ? segmentsFor(transcript.segments, ch) : transcript.segments;
    transcriptText = transcriptToText(segs);
  }
  return { system: SYSTEM_PROMPT(cfg.outputLanguage), task, transcriptText, chapter: ch };
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
  if (!cfg.geminiKey) throw new AiError('Не задан Gemini API key (Настройки).');
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
  if (!text) throw new AiError(`Gemini вернул пустой ответ (${json?.candidates?.[0]?.finishReason ?? 'unknown'}).`);
  return text;
}

async function openrouter(cfg: AiConfig, system: string, user: string): Promise<string> {
  if (!cfg.openrouterKey) throw new AiError('Не задан OpenRouter API key (Настройки).');
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
  if (!text) throw new AiError('OpenRouter вернул пустой ответ.');
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
  const { system, task, transcriptText, chapter } = buildPrompt(input, cfg);
  const onWait = (sec: number) => onStatus?.(`Лимит бесплатного тарифа, повтор через ${sec} с…`);

  if (cfg.provider === 'gemini') {
    const parts: Part[] = [];
    if (transcriptText) {
      parts.push({ text: `${task}\n\nТранскрипт (метки [м:сс] — таймкоды видео):\n${transcriptText}` });
    } else {
      const video: Part = { fileData: { fileUri: `https://www.youtube.com/watch?v=${input.video.id}` } };
      if (chapter && isFinite(chapter.end))
        (video as any).videoMetadata = { startOffset: `${chapter.start}s`, endOffset: `${Math.ceil(chapter.end)}s` };
      parts.push(video, { text: `${task}\n\n(Транскрипт недоступен — анализируй само видео${chapter ? ' в пределах указанного фрагмента' : ''}.)` });
    }
    return withRetry(() => gemini(cfg, system, parts), onWait);
  }

  if (!transcriptText)
    throw new AiError('Без транскрипта OpenRouter не может проанализировать видео. Выберите Gemini (умеет смотреть видео) или загрузите субтитры.');
  return withRetry(
    () => openrouter(cfg, system, `${task}\n\nТранскрипт (метки [м:сс] — таймкоды видео):\n${transcriptText}`),
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
