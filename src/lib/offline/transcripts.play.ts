/** Play build: only the helper the video screen needs, without any fetching. */
import type * as Real from './transcripts';

export const transcriptLangOf: typeof Real.transcriptLangOf = (t) =>
  (t.translatedTo ?? t.languageCode).toLowerCase().split('-')[0];
