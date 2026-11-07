import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../components/theme';
import { VideoRow } from '../../components/VideoRow';
import { formatCount } from '../../lib/format';
import { addRecentChannel, useSettings } from '../../lib/settings';
import type { ChannelInfo, VideoItem } from '../../lib/types';
import { listUploads, resolveChannel, uploadsPlaylistFor, type UploadsKind } from '../../lib/youtubeApi';

type SortKey = 'new' | 'old' | 'views' | 'title' | 'long';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'new', label: 'Новые' },
  { key: 'old', label: 'Старые' },
  { key: 'views', label: 'Популярные' },
  { key: 'long', label: 'Длинные' },
  { key: 'title', label: 'А–Я' },
];
const KINDS: { key: UploadsKind; label: string }[] = [
  { key: 'videos', label: 'Видео' },
  { key: 'shorts', label: 'Shorts' },
  { key: 'live', label: 'Трансляции' },
  { key: 'all', label: 'Все' },
];
/** Safety cap for "load all": 40 pages × 50 = 2000 videos ≈ 80 quota units. */
const MAX_PAGES = 40;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export default function ChannelScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings, loaded } = useSettings();
  const key = settings.youtubeKey;

  const [channel, setChannel] = useState<ChannelInfo>();
  const [kind, setKind] = useState<UploadsKind>('videos');
  const [items, setItems] = useState<VideoItem[]>([]);
  const [total, setTotal] = useState<number>();
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('new');
  const generation = useRef(0); // invalidates in-flight loads on tab switch
  const pagesLoaded = useRef(0);

  useEffect(() => {
    if (!loaded) return;
    resolveChannel({ kind: 'channelId', value: id }, key)
      .then((c) => {
        setChannel(c);
        addRecentChannel(c);
      })
      .catch((e) => setError(e.message));
  }, [id, key, loaded]);

  const loadPage = useCallback(
    async (token: string | undefined, gen: number) => {
      const page = await listUploads(uploadsPlaylistFor(id, kind), key, token);
      if (gen !== generation.current) return undefined;
      pagesLoaded.current++;
      setItems((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...page.items.filter((v) => !seen.has(v.id))];
      });
      setTotal(page.total);
      setNextToken(page.nextPageToken);
      return page.nextPageToken;
    },
    [id, kind, key],
  );

  // (Re)load first page when the content kind changes.
  useEffect(() => {
    if (!loaded) return;
    const gen = ++generation.current;
    pagesLoaded.current = 0;
    loadPage(undefined, gen)
      .catch((e) => gen === generation.current && setError(e.message))
      .finally(() => gen === generation.current && setLoading(false));
  }, [loadPage, loaded]);

  const selectKind = (k: UploadsKind) => {
    if (k === kind) return;
    setItems([]);
    setNextToken(undefined);
    setTotal(undefined);
    setError(undefined);
    setLoading(true);
    setKind(k);
  };

  const loadMore = async () => {
    if (loading || loadingAll || !nextToken) return;
    const gen = generation.current;
    setLoading(true);
    try {
      await loadPage(nextToken, gen);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  };

  const loadAll = async () => {
    if (loadingAll) return;
    const gen = generation.current;
    setLoadingAll(true);
    try {
      let token = nextToken;
      while (token && gen === generation.current && pagesLoaded.current < MAX_PAGES) token = await loadPage(token, gen);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingAll(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    const filtered = words.length ? items.filter((v) => words.every((w) => v.title.toLowerCase().includes(w))) : items;
    const sorted = [...filtered];
    switch (sort) {
      case 'new':
        sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        break;
      case 'old':
        sorted.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
        break;
      case 'views':
        sorted.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
        break;
      case 'long':
        sorted.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [items, query, sort]);

  const needsAllHint = !!nextToken && (sort !== 'new' || !!query.trim());
  const openVideo = useCallback(
    (v: VideoItem) => router.push({ pathname: '/video/[id]', params: { id: v.id, title: v.title } }),
    [],
  );

  const header = (
    <View>
      {channel && (
        <View style={styles.channel}>
          <Image source={channel.thumbnail} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.chTitle}>{channel.title}</Text>
            <Text style={styles.sub}>
              {[channel.handle, channel.videoCount != null && `${formatCount(channel.videoCount)} видео`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {KINDS.map((k) => (
          <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => selectKind(k.key)} />
        ))}
      </ScrollView>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск по названию"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SORTS.map((s) => (
          <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
        ))}
      </ScrollView>
      <View style={styles.status}>
        <Text style={styles.sub}>
          {query.trim() ? `Найдено ${visible.length} · ` : ''}
          Загружено {items.length}
          {total != null ? ` из ${total}` : ''}
        </Text>
        {nextToken && (
          <Pressable onPress={loadAll} disabled={loadingAll}>
            <Text style={styles.link}>{loadingAll ? 'Загружаю…' : 'Загрузить все'}</Text>
          </Pressable>
        )}
      </View>
      {needsAllHint && !loadingAll && (
        <Text style={styles.hint}>Сортировка и поиск работают по загруженным видео — нажмите «Загрузить все».</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: channel?.title ?? title ?? '' }} />
      <FlatList
        data={visible}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VideoRow item={item} onPress={openVideo} />}
        ListHeaderComponent={header}
        onEndReached={sort === 'new' && !query ? loadMore : undefined}
        onEndReachedThreshold={0.8}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          !loading && !error ? <Text style={[styles.hint, { textAlign: 'center' }]}>Ничего не найдено</Text> : undefined
        }
        ListFooterComponent={loading || loadingAll ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
        initialNumToRender={12}
        windowSize={11}
      />
    </>
  );
}

const styles = StyleSheet.create({
  channel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border },
  chTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { color: colors.muted, fontSize: 13 },
  chips: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.chipActive },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  search: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
  },
  status: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  link: { color: colors.link, fontWeight: '600', fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingBottom: 6 },
  error: { color: colors.accent, paddingHorizontal: 12, paddingBottom: 6 },
});
