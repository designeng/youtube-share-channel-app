import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENROUTER_MODEL, type AiConfig } from './ai';
import type { ChannelInfo } from './types';

export type Settings = AiConfig & {
  youtubeKey: string;
  /** BCP-47-ish code for transcripts, e.g. "ru", "en" */
  transcriptLang: string;
  /** How long a generated AI review stays cached, in minutes. 0 disables caching. */
  cacheTtlMin: number;
};

const SECRET_KEYS = ['youtubeKey', 'geminiKey', 'openrouterKey'] as const;

const DEFAULTS: Settings = {
  youtubeKey: '',
  provider: 'gemini',
  geminiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  openrouterKey: '',
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
  outputLanguage: 'русский',
  transcriptLang: 'ru',
  cacheTtlMin: 60,
};

const PREFS_KEY = 'prefs.v1';
const RECENT_KEY = 'recentChannels.v1';

type Ctx = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(settings);

  useEffect(() => {
    (async () => {
      const next = { ...DEFAULTS };
      try {
        Object.assign(next, JSON.parse((await AsyncStorage.getItem(PREFS_KEY)) ?? '{}'));
        for (const k of SECRET_KEYS) next[k] = (await SecureStore.getItemAsync(k)) ?? '';
      } catch {}
      ref.current = next;
      setSettings(next);
      setLoaded(true);
    })();
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const merged: Settings = { ...ref.current, ...patch };
    ref.current = merged;
    setSettings(merged);
    const prefs: Record<string, unknown> = { ...merged };
    for (const k of SECRET_KEYS) {
      delete prefs[k];
      if (k in patch) {
        const v = (patch[k] ?? '').trim();
        if (v) await SecureStore.setItemAsync(k, v);
        else await SecureStore.deleteItemAsync(k);
      }
    }
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

// ---- recent channels -------------------------------------------------------

export type RecentChannel = Pick<ChannelInfo, 'id' | 'title' | 'thumbnail' | 'handle'>;

export async function getRecentChannels(): Promise<RecentChannel[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function addRecentChannel(c: RecentChannel) {
  const list = (await getRecentChannels()).filter((x) => x.id !== c.id);
  list.unshift({ id: c.id, title: c.title, thumbnail: c.thumbnail, handle: c.handle });
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 20)));
}

export async function removeRecentChannel(id: string) {
  const list = (await getRecentChannels()).filter((x) => x.id !== id);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ---- AI review cache -------------------------------------------------------

const reviewKey = (videoId: string, target: number | 'all') => `review.v2:${videoId}:${target}`;

/** Returns the cached review text if it is younger than ttlMin minutes; drops it otherwise. */
export async function getCachedReview(videoId: string, target: number | 'all', ttlMin: number) {
  const key = reviewKey(videoId, target);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw) as { text: string; ts: number };
    if (ttlMin > 0 && text && Date.now() - ts < ttlMin * 60_000) return text;
    await AsyncStorage.removeItem(key);
  } catch {}
  return null;
}
export async function setCachedReview(videoId: string, target: number | 'all', text: string, ttlMin: number) {
  if (ttlMin <= 0) return;
  return AsyncStorage.setItem(reviewKey(videoId, target), JSON.stringify({ text, ts: Date.now() }));
}
