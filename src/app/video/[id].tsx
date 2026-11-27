import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { playerErrorText, type PlayerHandle } from '../../components/player';
import { AboutPanel } from '../../components/video/AboutPanel';
import { AiPanel, type ReviewState } from '../../components/video/AiPanel';
import { ChaptersPanel } from '../../components/video/ChaptersPanel';
import { ModeBar, type Mode } from '../../components/video/ModeBar';
import { shared } from '../../components/video/styles';
import { TranscriptPanel, type TrackChoice, type TrackOption } from '../../components/video/TranscriptPanel';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { generateReview } from '../../lib/ai';
import { autoParts, parseChapters } from '../../lib/chapters';
import { getCachedReview, setCachedReview, useSettings } from '../../lib/settings';
import { getTranscript, getTranscriptInfo, pickTrack } from '../../lib/transcript';
import type { Chapter, Transcript, TranscriptInfo, VideoDetails } from '../../lib/types';
import { getVideo } from '../../lib/youtubeApi';

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

  const [video, setVideo] = useState<VideoDetails>();
  const [error, setError] = useState<string>();
  const [time, setTime] = useState(0);
  const [playerError, setPlayerError] = useState<number>();
  const [mode, setMode] = useState<Mode>('chapters');
  const [aiFocus, setAiFocus] = useState<number>();

  const [info, setInfo] = useState<TranscriptInfo>();
  const [choice, setChoice] = useState<TrackChoice>();
  const [transcript, setTranscript] = useState<Transcript>();
  const [trLoading, setTrLoading] = useState(false);
  const [trError, setTrError] = useState<string>();

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
    setTime(sec); // highlight right away instead of waiting for the next player report
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
      if (reviews[k]?.loading) return;
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

  const review = (target: number | 'all', force?: boolean) => runReview(target, force).catch(() => {});

  // "AI" on a timecode: switch to the review mode and show (or generate) that chapter.
  const reviewFromChapters = (index: number) => {
    setAiFocus(index);
    setMode('ai');
    if (reviews[String(index)]?.text) patchReview(String(index), { open: true });
    else review(index);
  };

  const changeMode = (m: Mode) => {
    setAiFocus(undefined);
    setMode(m);
  };

  const trackOptions: TrackOption[] = useMemo(() => {
    if (!info) return [];
    const opts: TrackOption[] = info.tracks.map((t) => ({
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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: video?.title ?? title ?? '' }} />
      <YouTubePlayer ref={player} videoId={id} height={h} onTime={setTime} onError={setPlayerError} />
      {playerError != null && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{playerErrorText(playerError)}</Text>
          <Pressable onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${id}&t=${Math.floor(time)}s`)}>
            <Text style={shared.link}>Открыть в YouTube</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.content}>
        {mode === 'transcript' ? (
          <TranscriptPanel
            transcript={transcript}
            loading={trLoading}
            error={trError}
            options={trackOptions}
            choice={choice}
            time={time}
            onChoose={selectChoice}
            onSeek={seek}
          />
        ) : error ? (
          <Text style={[shared.error, styles.pad]}>{error}</Text>
        ) : !video ? (
          <ActivityIndicator style={{ margin: 24 }} />
        ) : mode === 'chapters' ? (
          <ChaptersPanel
            chapters={parts}
            authored={hasChapters}
            currentIndex={currentIdx}
            reviews={reviews}
            onSeek={seek}
            onReview={reviewFromChapters}
          />
        ) : mode === 'ai' ? (
          <AiPanel
            chapters={parts}
            authored={hasChapters}
            currentIndex={currentIdx}
            reviews={reviews}
            runningAll={runningAll}
            focusIndex={aiFocus}
            onRunAll={runAllChapters}
            onReview={review}
            onSeek={seek}
          />
        ) : (
          <AboutPanel video={video} onSeek={seek} />
        )}
      </View>

      <ModeBar mode={mode} onChange={changeMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  pad: { padding: 12 },
  banner: { backgroundColor: '#fff4e5', padding: 10, gap: 4 },
  bannerText: { color: '#8a4b00' },
});
