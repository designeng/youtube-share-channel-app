/**
 * AI prompts. Their language follows the review language, not the UI: models tend to answer, and name
 * headings, in the language they are asked in. Russian for Russian reviews, English for any other.
 */
import { formatTime } from './format';
import type { Chapter, VideoDetails } from './types';

type Prompts = {
  system: (lang: string) => string;
  chapterTask: (video: VideoDetails, ch: Chapter, total: number) => string;
  overviewTask: (video: VideoDetails, chapters: Chapter[]) => string;
  transcriptIntro: string;
  noTranscript: (clipped: boolean) => string;
};

const chapterList = (chapters: Chapter[]) =>
  chapters.map((c) => `${c.index + 1}. [${formatTime(c.start)}] ${c.title}`).join('\n');

const RU: Prompts = {
  system: (lang) => `Ты — внимательный аналитик видеоконтента. Твоя задача — ПОДРОБНЫЙ обзор, а не короткое резюме.
Правила:
- Пиши на языке: ${lang}, даже если транскрипт на другом языке.
- Сохраняй конкретику: факты, цифры, имена, термины, аргументы, примеры, шаги, рецепты, код, выводы автора.
- Передавай логику рассуждения автора: что утверждается, почему, на каких примерах.
- Указывай таймкоды в формате [м:сс] для ключевых моментов (бери их из меток транскрипта).
- Ничего не выдумывай. Если в транскрипте что-то неразборчиво (автосубтитры) — так и скажи.
- Не используй вступлений вроде "В этом видео...". Сразу к сути.
- Формат — Markdown: заголовки ###, списки, **жирный** для ключевых терминов.`,
  chapterTask: (video, ch, total) => `Видео: «${video.title}» (канал ${video.channelTitle}).
Глава ${ch.index + 1} из ${total}: «${ch.title}» [${formatTime(ch.start)}–${formatTime(ch.end)}].

Сделай подробный обзор ЭТОЙ главы:
### Суть
1–2 предложения: о чём глава и главный тезис.
### Подробно
Развёрнутый пересказ по пунктам в порядке изложения, с аргументами, примерами и таймкодами.
### Факты, цифры, цитаты
Всё конкретное, что стоит запомнить.
### Выводы
Что из этого следует / практические рекомендации (если есть).`,
  overviewTask: (video, chapters) => `Видео: «${video.title}» (канал ${video.channelTitle}, длительность ${formatTime(video.durationSec ?? 0)}).
Главы:
${chapterList(chapters)}

Сделай подробный обзор всего видео:
### Главная мысль
### По главам
Для КАЖДОЙ главы — заголовок "**N. Название [м:сс]**" и 4–8 содержательных пунктов.
### Ключевые факты и цифры
### Итог и практическая ценность`,
  transcriptIntro: 'Транскрипт (метки [м:сс] — таймкоды видео):',
  noTranscript: (clipped) =>
    `(Транскрипт недоступен — анализируй само видео${clipped ? ' в пределах указанного фрагмента' : ''}.)`,
};

const EN: Prompts = {
  system: (lang) => `You are an attentive analyst of video content. Your task is a DETAILED review, not a short summary.
Rules:
- Write in this language: ${lang}, even if the transcript is in another one. This includes the headings.
- Keep the specifics: facts, numbers, names, terms, arguments, examples, steps, recipes, code, the author's conclusions.
- Convey the author's reasoning: what is claimed, why, and with which examples.
- Give timecodes as [m:ss] for key moments (take them from the transcript markers).
- Do not invent anything. If part of the transcript is unintelligible (auto captions), say so.
- No introductions like "In this video...". Get straight to the point.
- Format: Markdown with ### headings, lists, **bold** for key terms.`,
  chapterTask: (video, ch, total) => `Video: “${video.title}” (channel ${video.channelTitle}).
Chapter ${ch.index + 1} of ${total}: “${ch.title}” [${formatTime(ch.start)}–${formatTime(ch.end)}].

Write a detailed review of THIS chapter:
### The gist
1–2 sentences: what the chapter is about and its main claim.
### In detail
A thorough point-by-point retelling in the order presented, with arguments, examples and timecodes.
### Facts, numbers, quotes
Everything specific that is worth remembering.
### Takeaways
What follows from this / practical recommendations (if any).`,
  overviewTask: (video, chapters) => `Video: “${video.title}” (channel ${video.channelTitle}, duration ${formatTime(video.durationSec ?? 0)}).
Chapters:
${chapterList(chapters)}

Write a detailed review of the whole video:
### Main idea
### Chapter by chapter
For EACH chapter, a heading "**N. Title [m:ss]**" and 4–8 substantial points.
### Key facts and numbers
### Conclusion and practical value`,
  transcriptIntro: 'Transcript ([m:ss] markers are video timecodes):',
  noTranscript: (clipped) =>
    `(No transcript is available — analyze the video itself${clipped ? ' within the given fragment' : ''}.)`,
};

export const promptsFor = (outputLanguage: string) => (/^\s*(ru|рус)/i.test(outputLanguage) ? RU : EN);
