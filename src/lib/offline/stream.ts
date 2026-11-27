/**
 * Finds a downloadable file for a video. Uses the same private InnerTube endpoint as transcripts, so the
 * same caveats apply (see transcript.ts). Only "progressive" formats hold video and sound in one file;
 * YouTube offers them up to 360p. Better quality comes as separate tracks that would need muxing.
 */
import { getLanguage, t } from '../i18n';
import { ANDROID_UA, androidPlayer } from '../transcript';

export type VideoStream = {
  url: string;
  headers: Record<string, string>;
  quality: string;
  /** size in bytes, estimated from the bitrate when YouTube does not say */
  size?: number;
};

export async function getVideoStream(videoId: string): Promise<VideoStream> {
  const json = await androidPlayer(videoId, getLanguage());
  const formats: any[] = json?.streamingData?.formats ?? [];
  const best = formats
    .filter((f) => f.url && f.mimeType?.startsWith('video/mp4'))
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
  if (!best) {
    const reason = json?.playabilityStatus?.reason;
    throw new Error(reason ? t().download.refused(reason) : t().download.noFile);
  }
  const estimate = (Number(best.bitrate) / 8) * (Number(best.approxDurationMs) / 1000);
  return {
    url: best.url,
    headers: { 'User-Agent': ANDROID_UA },
    quality: best.qualityLabel ?? '',
    size: Number(best.contentLength) || Math.round(estimate) || undefined,
  };
}
