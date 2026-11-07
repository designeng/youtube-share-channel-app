import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { InlineText, Markdown } from '../../components/Markdown';
import { colors } from '../../components/theme';
import { playerErrorText, YouTubePlayer, type PlayerHandle } from '../../components/YouTubePlayer';
import { generateReview } from '../../lib/ai';
import { autoParts, parseChapters, transcriptToText } from '../../lib/chapters';
import { formatCount, formatDate, formatTime } from '../../lib/format';
import { getCachedReview, setCachedReview, useSettings } from '../../lib/settings';
import { getTranscript, getTranscriptInfo, pickTrack } from '../../lib/transcript';
import type { Chapter, Transcript, TranscriptInfo, VideoDetails } from '../../lib/types';
import { getVideo } from '../../lib/youtubeApi';

type ReviewState = { text?: string; loading?: boolean; status?: string; error?: string; open?: boolean };
type TrackChoice = { languageCode: string; tlang?: string };

const base = (c?: string) => (c ?? '').toLowerCase().split('-')[0];

/** Best transcript for the AI: original language (more accurate than YouTube's machine translation). */
function originalTrack(info: TranscriptInfo, audioLang?: string) {
  const a = base(audioLang);
  return (
    info.tracks.find((t) => !t.isAuto && a && base(t.languageCode) === a) ??
    info.tracks.find((t) => t.isAuto) ??
    info.tracks.find((t) => !t.isAuto)
  );
}

export default function VideoScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings, loaded } = useSettings();
  const { width } = useWindowDimensions();
  const player = useRef<PlayerHandle>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  const [video, setVideo] = useState<VideoDetails>();
  const [error, setError] = useState<string>();
  const [time, setTime] = useState(0);
  const [playerError, setPlayerError] = useState<number>();
  const [descOpen, setDescOpen] = useState(false);

  const [info, setInfo] = useState<TranscriptInfo>();
  const [choice, setChoice] = useState<TrackChoice>();
  const [transcript, setTranscript] = useState<Transcript>();
  const [trLoading, setTrLoading] = useState(false);
  const [trError, setTrError] = useState<string>();
  const [trOpen, setTrOpen] = useState(false);

  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [runningAll, setRunningAll] = useState(false);
  const stopAll = useRef(false);
  const aiTranscript = useRef<Promise<Transcript | undefined> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    getVideo(id, settings.youtubeKey).then(setVideo, (e) => setError(e.message));
  }, [id, loaded, settings.youtubeKey]);

  const selectChoice = (c: TrackChoice) => {
    setTrLoading(true);
    setTrError(undefined);
    setChoice(c);
  };

  // Caption tracks + default choice (preferred locale; YouTube auto-translation if needed).
  useEffect(() => {
    if (!loaded) return;
    getTranscriptInfo(id, settings.transcriptLang)
      .then((i) => {
        setInfo(i);
        if (!i.tracks.length) return setTrError('У этого видео нет субтитров.');
        const p = pickTrack(i, settings.transcriptLang);
        selectChoice({ languageCode: p.track.languageCode, tlang: p.tlang });
      })
      .catch((e) => setTrError(e.message));
  }, [id, loaded, settings.transcriptLang]);

  useEffect(() => {
    if (!choice) return;
    let cancelled = false;
    getTranscript(id, { ...choice, hl: settings.transcriptLang })
      .then((t) => !cancelled && setTranscript(t))
      .catch((e) => !cancelled && setTrError(e.message))
      .finally(() => !cancelled && setTrLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, choice, settings.transcriptLang]);

  const chapters = useMemo(() => (video ? parseChapters(video.description, video.durationSec) : []), [video]);
  const hasChapters = chapters.length > 0;
  const parts: Chapter[] = useMemo(
    () => (hasChapters ? chapters : video?.durationSec ? autoParts(video.durationSec) : []),
    [chapters, hasChapters, video],
  );

  // Restore cached reviews.
  useEffect(() => {
    if (!video) return;
    (async () => {
      const next: Record<string, ReviewState> = {};
      for (const t of [...parts.map((p) => p.index), 'all' as const]) {
        const text = await getCachedReview(video.id, t, settings.cacheTtlMin);
        if (text) next[String(t)] = { text };
      }
      setReviews((r) => ({ ...next, ...r }));
    })();
  }, [video, parts, settings.cacheTtlMin]);

  const seek = useCallback((sec: number) => {
    player.current?.seekTo(sec);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const getAiTranscript = useCallback(async () => {
    if (!aiTranscript.current) {
      aiTranscript.current = (async () => {
        const i = info ?? (await getTranscriptInfo(id, settings.transcriptLang).catch(() => undefined));
        const track = i && originalTrack(i, video?.defaultAudioLanguage);
        if (!track) return undefined;
        if (transcript && transcript.languageCode === track.languageCode && !transcript.translatedTo) return transcript;
        return getTranscript(id, { languageCode: track.languageCode }).catch(() => undefined);
      })();
    }
    return aiTranscript.current;
  }, [id, info, settings.transcriptLang, transcript, video?.defaultAudioLanguage]);

  const patchReview = (k: string, p: ReviewState) => setReviews((r) => ({ ...r, [k]: { ...r[k], ...p } }));

  const runReview = useCallback(
    async (target: number | 'all', force = false) => {
      if (!video) return;
      const k = String(target);
      if (!force && reviews[k]?.text) return patchReview(k, { open: !reviews[k].open });
      patchReview(k, { loading: true, error: undefined, status: 'Получаю транскрипт…', open: true });
      try {
        const tr = await getAiTranscript();
        patchReview(k, { status: tr ? 'Генерирую обзор…' : 'Субтитров нет — Gemini смотрит видео…' });
        const text = await generateReview({ video, chapters: parts, transcript: tr, target }, settings, (status) =>
          patchReview(k, { status }),
        );
        await setCachedReview(video.id, target, text, settings.cacheTtlMin);
        patchReview(k, { text, loading: false, status: undefined });
      } catch (e: any) {
        patchReview(k, { error: e.message, loading: false, status: undefined });
        throw e;
      }
    },
    [video, reviews, getAiTranscript, parts, settings],
  );

  const runAllChapters = async () => {
    if (runningAll) {
      stopAll.current = true;
      return;
    }
    stopAll.current = false;
    setRunningAll(true);
    for (const p of parts) {
      if (stopAll.current) break;
      if (reviews[String(p.index)]?.text) continue;
      try {
        await runReview(p.index);
      } catch {
        break; // show the error on that chapter and stop
      }
    }
    setRunningAll(false);
  };

  const currentIdx = parts.findIndex((c) => time >= c.start && time < c.end);
  const h = Math.round((width * 9) / 16);

  const trackOptions: { label: string; choice: TrackChoice }[] = useMemo(() => {
    if (!info) return [];
    const opts: { label: string; choice: TrackChoice }[] = info.tracks.map((t) => ({
      label: `${t.name}${t.isAuto && !/auto|авто/i.test(t.name) ? ' (авто)' : ''}`,
      choice: { languageCode: t.languageCode },
    }));
    const want = settings.transcriptLang;
    const hasExact = info.tracks.some((t) => base(t.languageCode) === base(want));
    const src = info.tracks.find((t) => !t.isAuto && t.isTranslatable) ?? info.tracks.find((t) => t.isTranslatable);
    if (!hasExact && src && info.translationLanguages.some((l) => base(l.languageCode) === base(want)))
      opts.unshift({ label: `Перевод → ${want}`, choice: { languageCode: src.languageCode, tlang: want } });
    return opts;
  }, [info, settings.transcriptLang]);

  const transcriptLines = useMemo(
    () => (transcript ? transcriptToText(transcript.segments, 20).split('\n') : []),
    [transcript],
  );

  return (
    <>
      <Stack.Screen options={{ title: video?.title ?? title ?? '' }} />
      <YouTubePlayer ref={player} videoId={id} height={h} onTime={setTime} onError={setPlayerError} />
      <ScrollView ref={scroll} contentContainerStyle={styles.body}>
        {playerError != null && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{playerErrorText(playerError)}</Text>
            <Pressable onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${id}&t=${Math.floor(time)}s`)}>
              <Text style={styles.link}>Открыть в YouTube</Text>
            </Pressable>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        {!video && !error && <ActivityIndicator style={{ margin: 24 }} />}

        {video && (
          <>
            <Text style={styles.title}>{video.title}</Text>
            <Text style={styles.sub}>
              {video.channelTitle} · {formatDate(video.publishedAt)}
              {video.viewCount != null ? ` · ${formatCount(video.viewCount)} просм.` : ''}
              {video.likeCount != null ? ` · 👍 ${formatCount(video.likeCount)}` : ''}
              {video.durationSec ? ` · ${formatTime(video.durationSec)}` : ''}
            </Text>

            {/* Description ("more…") */}
            {!!video.description && (
              <Pressable style={styles.card} onPress={() => setDescOpen((o) => !o)}>
                <Text style={styles.desc} numberOfLines={descOpen ? undefined : 3}>
                  <InlineText text={video.description} onTime={seek} />
                </Text>
                <Text style={styles.more}>{descOpen ? 'Свернуть' : 'ещё…'}</Text>
              </Pressable>
            )}

            {/* Chapters + AI */}
            <View style={styles.sectionHead}>
              <Text style={styles.section}>{hasChapters ? `Главы (${chapters.length})` : 'Части видео'}</Text>
            </View>
            {!hasChapters && parts.length > 0 && (
              <Text style={styles.hint}>
                Автор не разметил главы — видео разбито на части по ~10 минут для подробного AI-обзора.
              </Text>
            )}
            <View style={styles.aiButtons}>
              <Pressable style={[styles.btn, runningAll && styles.btnStop]} onPress={runAllChapters}>
                <Text style={styles.btnText}>
                  {runningAll ? 'Остановить' : `AI-обзор всех ${hasChapters ? 'глав' : 'частей'} по очереди`}
                </Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => runReview('all').catch(() => {})}>
                <Text style={[styles.btnText, { color: colors.text }]}>Общий обзор</Text>
              </Pressable>
            </View>
            <ReviewBlock state={reviews.all} onTime={seek} onRetry={() => runReview('all', true).catch(() => {})} />

            {parts.map((c) => {
              const r = reviews[String(c.index)];
              return (
                <View key={c.index} style={[styles.chapter, currentIdx === c.index && styles.chapterActive]}>
                  <View style={styles.chapterRow}>
                    <Pressable onPress={() => seek(c.start)} style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                      <Text style={styles.time}>{formatTime(c.start)}</Text>
                      <Text style={styles.chTitle}>{c.title}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => runReview(c.index).catch(() => {})}
                      style={[styles.aiChip, r?.text && styles.aiChipDone]}
                      hitSlop={6}
                    >
                      <Text style={[styles.aiChipText, r?.text && { color: '#fff' }]}>
                        {r?.loading ? '…' : r?.text ? (r.open ? 'AI ▾' : 'AI ▸') : 'AI'}
                      </Text>
                    </Pressable>
                  </View>
                  <ReviewBlock state={r} onTime={seek} onRetry={() => runReview(c.index, true).catch(() => {})} />
                </View>
              );
            })}

            {/* Transcript */}
            <View style={styles.sectionHead}>
              <Text style={styles.section}>Транскрипт</Text>
              {transcript && (
                <Pressable onPress={() => setTrOpen((o) => !o)}>
                  <Text style={styles.link}>{trOpen ? 'Свернуть' : 'Показать всё'}</Text>
                </Pressable>
              )}
            </View>
            {trackOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {trackOptions.map((o) => {
                  const active = choice?.languageCode === o.choice.languageCode && choice?.tlang === o.choice.tlang;
                  return (
                    <Pressable key={o.label} onPress={() => selectChoice(o.choice)} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && { color: '#fff' }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {trLoading && <ActivityIndicator style={{ margin: 12 }} />}
            {trError && !trLoading && <Text style={styles.hint}>{trError}</Text>}
            {transcript?.translationFailed && (
              <Text style={styles.hint}>
                YouTube ограничил автоперевод субтитров (лимит запросов) — показан оригинал. AI-обзор всё равно будет на
                выбранном языке.
              </Text>
            )}
            {transcript && !trLoading && (
              <View style={styles.card}>
                {(trOpen ? transcriptLines : transcriptLines.slice(0, 8)).map((l, i) => (
                  <Text key={i} style={styles.trLine}>
                    <InlineText text={l} onTime={seek} />
                  </Text>
                ))}
                {!trOpen && transcriptLines.length > 8 && (
                  <Pressable onPress={() => setTrOpen(true)}>
                    <Text style={styles.more}>ещё {transcriptLines.length - 8} фрагм.…</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function ReviewBlock({ state, onTime, onRetry }: { state?: ReviewState; onTime: (s: number) => void; onRetry: () => void }) {
  if (!state?.open && !state?.loading && !state?.error) return null;
  return (
    <View style={styles.review}>
      {state.loading && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
          <Text style={styles.hint}>{state.status ?? 'Думаю…'}</Text>
        </View>
      )}
      {state.error && (
        <>
          <Text style={styles.error}>{state.error}</Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.link}>Повторить</Text>
          </Pressable>
        </>
      )}
      {state.text && state.open && !state.loading && (
        <>
          <Markdown text={state.text} onTime={onTime} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <Pressable onPress={() => Share.share({ message: state.text! })}>
              <Text style={styles.link}>Поделиться</Text>
            </Pressable>
            <Pressable onPress={onRetry}>
              <Text style={styles.link}>Перегенерировать</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 12, gap: 8, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 12, gap: 4 },
  desc: { fontSize: 14, lineHeight: 20, color: colors.text },
  more: { fontWeight: '700', color: colors.text, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { color: colors.muted, fontSize: 13 },
  error: { color: colors.accent, fontSize: 14 },
  link: { color: colors.link, fontWeight: '600' },
  aiButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: colors.chipActive, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnSecondary: { backgroundColor: colors.card },
  btnStop: { backgroundColor: colors.accent },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  chapter: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8 },
  chapterActive: { backgroundColor: '#fdeceb' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: colors.link, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 48 },
  chTitle: { flex: 1, color: colors.text, fontSize: 14 },
  aiChip: { borderWidth: 1, borderColor: colors.chipActive, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  aiChipDone: { backgroundColor: colors.chipActive },
  aiChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  review: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginTop: 6, gap: 6 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.chipActive },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  trLine: { fontSize: 14, lineHeight: 20, color: colors.text },
  banner: { backgroundColor: '#fff4e5', borderRadius: 8, padding: 10, gap: 4 },
  bannerText: { color: '#8a4b00' },
});
