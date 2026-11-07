/**
 * YouTube Data API v3 (official). Free quota: 10 000 units/day per API key.
 * Costs used here: channels.list = 1, playlistItems.list = 1, videos.list = 1 per call (50 items).
 * search.list (100 units) is deliberately avoided.
 */
import type { ChannelRef } from './parseUrl';
import { parseIsoDuration } from './format';
import type { ChannelInfo, VideoDetails, VideoItem } from './types';

const API = 'https://www.googleapis.com/youtube/v3';

export class YouTubeApiError extends Error {
  constructor(message: string, public status?: number, public reason?: string) {
    super(message);
  }
}

async function call<T = any>(path: string, params: Record<string, string>, key: string): Promise<T> {
  if (!key) throw new YouTubeApiError('Не задан YouTube API key (Настройки).', 0, 'noKey');
  const qs = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason;
    const msg =
      reason === 'quotaExceeded'
        ? 'Дневная квота YouTube API исчерпана (сбрасывается в полночь по тихоокеанскому времени).'
        : json?.error?.message ?? `YouTube API: HTTP ${res.status}`;
    throw new YouTubeApiError(msg, res.status, reason);
  }
  return json as T;
}

function bestThumb(t: any): string | undefined {
  return t?.maxres?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url;
}

/** Finds the channel id for /c/Name and legacy vanity URLs by reading the public channel page. */
async function scrapeChannelId(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: { 'Accept-Language': 'en', Cookie: 'CONSENT=YES+1' } });
  const html = await res.text();
  return (
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ??
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ??
    html.match(/"channelId":"(UC[\w-]{22})"/)?.[1]
  );
}

export async function resolveChannel(ref: ChannelRef, key: string): Promise<ChannelInfo> {
  const params: Record<string, string> = { part: 'snippet,contentDetails,statistics' };
  switch (ref.kind) {
    case 'channelId':
      params.id = ref.value;
      break;
    case 'handle':
      params.forHandle = `@${ref.value}`;
      break;
    case 'user':
      params.forUsername = ref.value;
      break;
    case 'custom': {
      const id = await scrapeChannelId(ref.url);
      if (!id) throw new YouTubeApiError('Не удалось определить канал по ссылке.');
      params.id = id;
      break;
    }
    case 'video': {
      const v = await call('videos', { part: 'snippet', id: ref.value }, key);
      const channelId = v.items?.[0]?.snippet?.channelId;
      if (!channelId) throw new YouTubeApiError('Видео не найдено.');
      params.id = channelId;
      break;
    }
  }
  const json = await call('channels', params, key);
  const c = json.items?.[0];
  if (!c) throw new YouTubeApiError('Канал не найден.');
  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl,
    description: c.snippet.description,
    thumbnail: bestThumb(c.snippet.thumbnails),
    uploadsPlaylistId: c.contentDetails.relatedPlaylists.uploads,
    videoCount: c.statistics?.videoCount ? Number(c.statistics.videoCount) : undefined,
  };
}

/**
 * Uploads playlist variants (undocumented but stable prefixes of the "UU" uploads playlist):
 *   UU = all uploads, UULF = long videos (no Shorts), UUSH = Shorts, UULV = past live streams.
 */
export type UploadsKind = 'all' | 'videos' | 'shorts' | 'live';
export function uploadsPlaylistFor(channelId: string, kind: UploadsKind): string {
  const suffix = channelId.slice(2);
  return { all: 'UU', videos: 'UULF', shorts: 'UUSH', live: 'UULV' }[kind] + suffix;
}

export type VideoPage = { items: VideoItem[]; nextPageToken?: string; total?: number };

export async function listUploads(playlistId: string, key: string, pageToken?: string): Promise<VideoPage> {
  let pl: any;
  try {
    pl = await call(
      'playlistItems',
      { part: 'contentDetails', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) },
      key,
    );
  } catch (e) {
    // UULF/UUSH/UULV playlists 404 when the channel has no such content.
    if (e instanceof YouTubeApiError && e.status === 404) return { items: [], total: 0 };
    throw e;
  }
  const ids: string[] = pl.items.map((i: any) => i.contentDetails.videoId);
  const details = ids.length ? await getVideosBasic(ids, key) : [];
  const byId = new Map(details.map((d) => [d.id, d]));
  return {
    // keep playlist order, drop private/deleted videos (absent from videos.list)
    items: ids.map((id) => byId.get(id)).filter(Boolean) as VideoItem[],
    nextPageToken: pl.nextPageToken,
    total: pl.pageInfo?.totalResults,
  };
}

function mapVideo(v: any): VideoDetails {
  return {
    id: v.id,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    thumbnail: bestThumb(v.snippet.thumbnails),
    durationSec: parseIsoDuration(v.contentDetails?.duration),
    viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
    likeCount: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
    description: v.snippet.description ?? '',
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    defaultAudioLanguage: v.snippet.defaultAudioLanguage,
  };
}

async function getVideosBasic(ids: string[], key: string): Promise<VideoDetails[]> {
  const json = await call('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(','), maxResults: '50' }, key);
  return json.items.map(mapVideo);
}

export async function getVideo(id: string, key: string): Promise<VideoDetails> {
  const [v] = await getVideosBasic([id], key);
  if (!v) throw new YouTubeApiError('Видео не найдено или недоступно.');
  return v;
}
