import { forgetTranscriptInfo, getTranscript, getTranscriptInfo, originalTrack, pickTrack } from '../transcript';
import type { Transcript, VideoDetails } from '../types';

const base = (c: string) => c.toLowerCase().split('-')[0];

/** Language a transcript is written in. */
export const transcriptLangOf = (t: Transcript) => base(t.translatedTo ?? t.languageCode);

/**
 * Collects transcripts to keep with a video: the original one (for AI reviews) and every requested language,
 * taken from the video's own captions or from YouTube's auto-translation. Never throws.
 */
export async function fetchOfflineTranscripts(video: VideoDetails, langs: string[], have: Transcript[] = []) {
  const transcripts = [...have];
  const add = (t: Transcript) => {
    if (!transcripts.some((x) => x.languageCode === t.languageCode && x.translatedTo === t.translatedTo)) transcripts.push(t);
  };
  const covered = (lang: string) => transcripts.some((t) => transcriptLangOf(t) === lang);

  try {
    forgetTranscriptInfo(video.id);
    const info = await getTranscriptInfo(video.id);
    const original = originalTrack(info, video.defaultAudioLanguage);
    if (original && !have.length) add(await getTranscript(video.id, { languageCode: original.languageCode }));

    for (const lang of langs) {
      if (!info.tracks.length || covered(lang)) continue;
      const { track, tlang } = pickTrack(info, lang);
      // No own track and no translation: pickTrack falls back to an unrelated language.
      if (!tlang && base(track.languageCode) !== lang) continue;
      try {
        const t = await getTranscript(video.id, { languageCode: track.languageCode, tlang });
        // A failed translation returns the original text; the get_transcript fallback ignores the language.
        if (!t.translationFailed && t.source === 'timedtext') add({ ...t, isAuto: track.isAuto });
      } catch {}
    }
  } catch {}

  return { transcripts, missingLangs: langs.filter((l) => !covered(l)) };
}
