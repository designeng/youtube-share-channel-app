/**
 * Play build: no transcripts. The official API gives captions to the video's owner only, and the private
 * endpoints used by transcript.ts are against YouTube's terms. AI reviews let Gemini watch the video instead.
 */
import type * as Real from './transcript';

export const getTranscriptInfo: typeof Real.getTranscriptInfo = async () => ({ tracks: [], translationLanguages: [] });
export const pickTrack: typeof Real.pickTrack = (info) => ({ track: info.tracks[0] });
export const originalTrack: typeof Real.originalTrack = () => undefined;
export const forgetTranscriptInfo: typeof Real.forgetTranscriptInfo = () => {};
export const getTranscript: typeof Real.getTranscript = async () => {
  throw new Error('Transcripts are not available in this build');
};
