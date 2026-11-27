/**
 * Runs downloads and tells the UI about them. Lives outside React so a download keeps going when its screen
 * is closed. Downloads need the app to stay alive: closing it drops them.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { videoParts } from '../chapters';
import { confirm } from '../confirm';
import { formatBytes } from '../format';
import { getCachedReview } from '../settings';
import type { VideoDetails } from '../types';
import { getNetworkKind, onNetworkChange } from './network';
import * as store from './store';
import { getVideoStream } from './stream';
import { fetchOfflineTranscripts } from './transcripts';
import type { DownloadRecord, SavedReviews } from './types';

/** fetch has no timeout of its own on Android, and a request caught by a network switch may never end. */
const REQUEST_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('YouTube не отвечает. Проверьте сеть и повторите.'));
    const timer = setTimeout(fail, REQUEST_TIMEOUT_MS);
    signal.addEventListener('abort', fail);
    work.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener('abort', fail);
    });
  });
}

const WIFI_LOST = 'Wi-Fi отключился — загрузка остановлена, чтобы не тратить мобильный трафик.';

export type ActiveDownload = {
  videoId: string;
  title: string;
  phase: 'preparing' | 'video' | 'transcripts' | 'error';
  /** 0..1, absent while the size is unknown */
  progress?: number;
  error?: string;
};

export type DownloadOptions = { wifiOnly: boolean; langs: string[]; reviewTtlMin: number };

type State = { active: Record<string, ActiveDownload>; /** bumps when saved files change */ version: number };

let state: State = { active: {}, version: 0 };
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
const setActive = (id: string, item: ActiveDownload | undefined) => {
  const active = { ...state.active };
  if (item) active[id] = item;
  else delete active[id];
  emit({ active });
};
const libraryChanged = () => emit({ version: state.version + 1 });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const snapshot = () => state;

/** Running (and failed) downloads. */
export const useActiveDownloads = () => useSyncExternalStore(subscribe, snapshot, snapshot).active;
const useLibraryVersion = () => useSyncExternalStore(subscribe, () => state.version, () => state.version);

export function useDownload(videoId: string): DownloadRecord | undefined {
  const version = useLibraryVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => store.readRecord(videoId), [videoId, version]);
}

export function useDownloadList(): DownloadRecord[] {
  const version = useLibraryVersion();
  return useMemo(() => {
    store.removeIncomplete([...controllers.keys()]);
    return store.listRecords().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/** Asks before using mobile data. Returns undefined when the download must not start. */
async function allowNetwork(size: number | undefined, wifiOnly: boolean) {
  const kind = await getNetworkKind();
  if (kind === 'offline') throw new Error('Нет подключения к интернету.');
  if (kind === 'wifi') return { mobileAllowed: !wifiOnly };
  const traffic = size ? `около ${formatBytes(size)}` : 'неизвестный объём';
  const ok = await confirm({
    title: 'Мобильная сеть',
    message: wifiOnly
      ? `Wi-Fi не подключён, а скачивание по умолчанию идёт только по Wi-Fi. Всё равно скачать по мобильной сети? Расход трафика: ${traffic}.`
      : `Wi-Fi не подключён. Скачивание израсходует мобильный трафик: ${traffic}.`,
    confirmLabel: 'Скачать по мобильной',
  });
  return ok ? { mobileAllowed: true } : undefined;
}

export async function startDownload(video: VideoDetails, { wifiOnly, langs, reviewTtlMin }: DownloadOptions) {
  const id = video.id;
  if (controllers.has(id)) return;
  const controller = new AbortController();
  controllers.set(id, controller);
  const item: ActiveDownload = { videoId: id, title: video.title, phase: 'preparing' };
  const update = (patch: Partial<ActiveDownload>) => {
    Object.assign(item, patch);
    if (!controller.signal.aborted) setActive(id, { ...item });
  };
  let stopReason: string | undefined;
  let unwatch: (() => void) | undefined;
  let mobileAllowed = false;
  update({});

  try {
    const stream = await withTimeout(getVideoStream(id), controller.signal);
    const network = await allowNetwork(stream.size, wifiOnly);
    if (!network || controller.signal.aborted) return setActive(id, undefined);
    if (stream.size && store.freeSpace() < stream.size * 1.1)
      throw new Error(`Мало места на телефоне: нужно ${formatBytes(stream.size)}.`);

    mobileAllowed = network.mobileAllowed;
    if (!mobileAllowed)
      unwatch = onNetworkChange((kind) => {
        if (kind !== 'metered') return;
        stopReason = WIFI_LOST;
        controller.abort();
      });

    let percent = -1;
    update({ phase: 'video', progress: 0 });
    const bytes = await store.downloadVideo(id, stream.url, {
      headers: stream.headers,
      signal: controller.signal,
      onProgress: (written, total) => {
        const size = total > 0 ? total : stream.size;
        const next = size ? Math.min(99, Math.floor((written / size) * 100)) : -1;
        if (next === percent) return;
        percent = next;
        update({ progress: next < 0 ? undefined : next / 100 });
      },
    });
    unwatch?.();

    update({ phase: 'transcripts', progress: undefined });
    if (video.thumbnail) await store.downloadThumbnail(id, video.thumbnail).catch(() => {});
    // Subtitles are a bonus: do not lose the downloaded video over them, they can be fetched later.
    const subtitles = await withTimeout(fetchOfflineTranscripts(video, langs), controller.signal).catch(() => ({
      transcripts: [],
      missingLangs: langs,
    }));
    if (controller.signal.aborted) throw new Error('aborted');
    if (controllers.get(id) !== controller) return;
    store.writeRecord({ video, bytes, quality: stream.quality, savedAt: new Date().toISOString(), ...subtitles });
    await keepCachedReviews(video, reviewTtlMin);
    setActive(id, undefined);
    libraryChanged();
  } catch (e: any) {
    // After a cancel a new download of the same video may already own the folder.
    if (controllers.get(id) !== controller) return;
    store.removeRecord(id);
    let error: string = e.message;
    // The connection usually breaks before the network change is reported, with a native error.
    if (item.phase === 'video' && !controller.signal.aborted) {
      const wifiGone = !mobileAllowed && (await getNetworkKind()) !== 'wifi';
      error = wifiGone ? WIFI_LOST : 'Связь прервалась. Проверьте сеть и повторите.';
    }
    if (controllers.get(id) !== controller) return;
    const cancelled = controller.signal.aborted && !stopReason;
    setActive(id, cancelled ? undefined : { ...item, phase: 'error', progress: undefined, error: stopReason ?? error });
  } finally {
    unwatch?.();
    if (controllers.get(id) === controller) controllers.delete(id);
  }
}

/** Keeps AI reviews with the downloaded copy, where they do not expire. Does nothing for other videos. */
export function saveReviews(videoId: string, reviews: SavedReviews) {
  if (!store.readRecord(videoId)) return;
  const saved = store.readReviews(videoId);
  if (Object.entries(reviews).some(([target, text]) => saved[target] !== text))
    store.writeReviews(videoId, { ...saved, ...reviews });
}

export const readSavedReviews = (videoId: string) => store.readReviews(videoId);

/** Reviews made before the download are still in the temporary cache. */
async function keepCachedReviews(video: VideoDetails, ttlMin: number) {
  const found: SavedReviews = {};
  for (const target of [...videoParts(video).parts.map((p) => p.index), 'all' as const]) {
    const text = await getCachedReview(video.id, target, ttlMin);
    if (text) found[String(target)] = text;
  }
  saveReviews(video.id, found);
}

/** Cancels a running download or dismisses a failed one. */
export function cancelDownload(videoId: string) {
  controllers.get(videoId)?.abort();
  // Cancelled before the next start: the cleanup of the old run must not touch the new one.
  if (controllers.delete(videoId)) store.removeRecord(videoId);
  setActive(videoId, undefined);
}

export function deleteDownload(videoId: string) {
  store.removeRecord(videoId);
  libraryChanged();
}

export function deleteAllDownloads() {
  for (const r of store.listRecords()) store.removeRecord(r.video.id);
  libraryChanged();
}

/** Tries again to get the transcripts that were not saved (e.g. translation was rate-limited). */
export async function retryTranscripts(videoId: string) {
  const record = store.readRecord(videoId);
  if (!record) return [];
  const subtitles = await withTimeout(
    fetchOfflineTranscripts(record.video, record.missingLangs, record.transcripts),
    new AbortController().signal,
  ).catch(() => record);
  if (store.readRecord(videoId)) {
    store.writeRecord({ ...record, ...subtitles });
    libraryChanged();
  }
  return subtitles.missingLangs;
}
