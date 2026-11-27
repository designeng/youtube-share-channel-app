import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { radius, space, themed, useColors, useType } from '../../components/theme';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { useScreenInsets } from '../../components/ui/layout';
import { Segmented } from '../../components/ui/Segmented';
import { StateView } from '../../components/ui/StateView';
import { VideoRow, VideoRowSkeleton } from '../../components/VideoRow';
import { errorText, formatCount } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import { addRecentChannel, useSettings } from '../../lib/settings';
import type { ChannelInfo, VideoItem } from '../../lib/types';
import { listUploads, resolveChannel, uploadsPlaylistFor, type UploadsKind } from '../../lib/youtubeApi';

type SortKey = 'new' | 'old' | 'views' | 'title' | 'long';
const SORTS: SortKey[] = ['new', 'old', 'views', 'long', 'title'];
const KINDS: UploadsKind[] = ['videos', 'shorts', 'live', 'all'];
/** Safety cap for "load all": 40 pages × 50 = 2000 videos ≈ 80 quota units. */
const MAX_PAGES = 40;

export default function ChannelScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings, loaded } = useSettings();
  const insets = useScreenInsets();
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
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
  // Bumped by "retry".
  const [channelAttempt, setChannelAttempt] = useState(0);
  const [listAttempt, setListAttempt] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    resolveChannel({ kind: 'channelId', value: id }, key)
      .then((c) => {
        setChannel(c);
        addRecentChannel(c);
      })
      .catch((e) => setError(e.message));
  }, [id, key, loaded, channelAttempt]);

  const loadPage = useCallback(
    async (token: string | undefined, gen: number) => {
      const page = await listUploads(uploadsPlaylistFor(id, kind), key, token);
      if (gen !== generation.current) return undefined;
      pagesLoaded.current++;
      setError(undefined);
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
  }, [loadPage, loaded, listAttempt]);

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

  const retry = () => {
    setError(undefined);
    if (!channel) setChannelAttempt((n) => n + 1);
    if (items.length) loadMore();
    else {
      setLoading(true);
      setListAttempt((n) => n + 1);
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

  const errorActions = error && (
    <>
      {/key|ключ/i.test(error) && <Button icon="settings" label={s.common.openSettings} onPress={() => router.push('/settings')} />}
      <Button variant="secondary" icon="refresh" label={s.common.retry} onPress={retry} />
    </>
  );

  const header = (
    <View style={styles.header}>
      {channel && (
        <View style={styles.channel}>
          <Image source={channel.thumbnail} style={styles.avatar} />
          <View style={styles.fill}>
            <Text style={type.title} numberOfLines={2}>
              {channel.title}
            </Text>
            <Text style={type.caption}>
              {[channel.handle, channel.videoCount != null && s.channel.videoCount(formatCount(channel.videoCount))]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.pad}>
        <Segmented options={KINDS.map((key) => ({ key, label: s.channel.kinds[key] }))} value={kind} onChange={selectKind} />
      </View>
      <View style={styles.pad}>
        <Input
          icon="search"
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder={s.channel.searchPlaceholder}
          returnKeyType="search"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts}>
        <View aria-label={s.channel.sortLabel}>
          <Icon name="sort" size={18} color={colors.muted} />
        </View>
        {SORTS.map((key) => (
          <Chip key={key} label={s.channel.sorts[key]} active={sort === key} onPress={() => setSort(key)} />
        ))}
      </ScrollView>
      {items.length > 0 && (
        <View style={styles.status}>
          <Text style={[type.caption, styles.fill]}>
            {query.trim() ? `${s.channel.found(visible.length)} · ` : ''}
            {s.channel.loaded(items.length, total)}
          </Text>
          {nextToken && (
            <Button small variant="ghost" label={loadingAll ? s.channel.loadingAll : s.channel.loadAll} onPress={loadAll} disabled={loadingAll} />
          )}
        </View>
      )}
      {needsAllHint && !loadingAll && (
        <View style={styles.pad}>
          <Banner text={s.channel.needsAllHint} />
        </View>
      )}
      {error && items.length > 0 && (
        <View style={styles.pad}>
          <Banner tone="error" text={errorText(error)} actionLabel={s.common.retry} onAction={retry} />
        </View>
      )}
    </View>
  );

  const empty =
    loading || loadingAll ? (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <VideoRowSkeleton key={i} />
        ))}
      </>
    ) : error ? (
      <StateView icon="alert" tone="error" title={s.channel.loadFailed} message={errorText(error)}>
        {errorActions}
      </StateView>
    ) : query.trim() ? (
      <StateView icon="search" title={s.channel.nothingFound} message={s.channel.nothingFoundMessage}>
        <Button variant="secondary" label={s.channel.resetSearch} onPress={() => setQuery('')} />
      </StateView>
    ) : (
      <StateView icon="video" title={s.channel.empty} message={s.channel.emptyMessage} />
    );

  return (
    <>
      <Stack.Screen options={{ title: channel?.title ?? title ?? '' }} />
      <FlatList
        data={visible}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VideoRow item={item} onPress={openVideo} />}
        contentContainerStyle={insets}
        ListHeaderComponent={header}
        onEndReached={sort === 'new' && !query && !error ? loadMore : undefined}
        onEndReachedThreshold={0.8}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={empty}
        ListFooterComponent={
          (loading || loadingAll) && visible.length > 0 ? (
            <ActivityIndicator style={styles.more} color={colors.muted} />
          ) : undefined
        }
        initialNumToRender={12}
        windowSize={11}
      />
    </>
  );
}

const useStyles = themed((colors) => ({
  fill: { flex: 1 },
  header: { gap: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  pad: { paddingHorizontal: space.lg },
  channel: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  avatar: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.surface },
  sorts: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: 28 },
  more: { margin: space.lg },
}));
