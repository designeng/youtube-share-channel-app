import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playerErrorText, type PlayerHandle } from '../../components/player';
import { MAX_WIDTH, space } from '../../components/theme';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { StateView } from '../../components/ui/StateView';
import { AboutPanel } from '../../components/video/AboutPanel';
import { AiPanel, type ReviewState } from '../../components/video/AiPanel';
import { ChaptersPanel } from '../../components/video/ChaptersPanel';
import { DownloadBar } from '../../components/video/DownloadBar';
import { Layer } from '../../components/video/Layer';
import { LocalPlayer } from '../../components/LocalPlayer';
import { ModeBar, type Mode } from '../../components/video/ModeBar';
import { TranscriptPanel, type TrackChoice, type TrackOption } from '../../components/video/TranscriptPanel';
import { useAiTranslation } from '../../components/video/useAiTranslation';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { generateReview } from '../../lib/ai';
import { getTranslation } from '../../lib/aiTranslate';
import { videoParts } from '../../lib/chapters';
import { errorText } from '../../lib/format';
import { t, useStrings } from '../../lib/i18n';
import { addTranscript, deleteDownload, readSavedReviews, saveReviews, useDownload } from '../../lib/offline/manager';
import { videoUri } from '../../lib/offline/store';
import { transcriptLangOf } from '../../lib/offline/transcripts';
import { getCachedReview, setCachedReview, useSettings } from '../../lib/settings';
import { forgetTranscriptInfo, getTranscript, getTranscriptInfo, originalTrack, pickTrack } from '../../lib/transcript';
import type { Chapter, Transcript, TranscriptInfo, VideoDetails } from '../../lib/types';
import { getVideo } from '../../lib/youtubeApi';

const base = (c?: string) => (c ?? '').toLowerCase().split('-')[0];

const choiceOf = (t: Transcript): TrackChoice => ({ languageCode: t.languageCode, tlang: t.translatedTo });
const sameChoice = (t: Transcript, c?: TrackChoice) => t.languageCode === c?.languageCode && t.translatedTo === c.tlang;

function savedLabel(transcript: Transcript) {
  if (transcript.translatedTo) return t().video.translation(transcript.translatedTo);
  const name = { ru: 'Русский', en: 'English' }[transcriptLangOf(transcript)] ?? transcript.languageCode;
  return transcript.isAuto ? `${name} (${t().video.auto})` : name;
}

export default function VideoScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings, loaded } = useSettings();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = useStrings();
  const player = useRef<PlayerHandle>(null);

  // A downloaded copy gives the video details, timecodes, transcripts and the file itself without a network.
  const record = useDownload(id);
  const saved = record?.transcripts;
  const hasRecord = !!record;
  const hasSaved = !!saved?.length;
  // The player is picked when the screen opens: a download finishing meanwhile must not restart playback.
  const [local, setLocal] = useState<{ startSec: number } | undefined>(() => (record ? { startSec: 0 } : undefined));
  const [fileError, setFileError] = useState(false);
  const playLocal = !!record && !!local;

  const [remoteVideo, setRemoteVideo] = useState<VideoDetails>();
  const video = record?.video ?? remoteVideo;
  const [error, setError] = useState<string>();
  // Bumped by "retry".
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [infoAttempt, setInfoAttempt] = useState(0);
  const [time, setTime] = useState(0);
  const [playerError, setPlayerError] = useState<number>();
  const [mode, setMode] = useState<Mode>('chapters');
  const [aiFocus, setAiFocus] = useState<number>();
  const [transcriptOpened, setTranscriptOpened] = useState(false);

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
    if (!loaded || hasRecord) return;
    getVideo(id, settings.youtubeKey).then(setRemoteVideo, (e) => setError(e.message));
  }, [id, loaded, hasRecord, settings.youtubeKey, videoAttempt]);

  const selectChoice = (c: TrackChoice) => {
    setTrLoading(true);
    setTrError(undefined);
    // Always a new object: the loading effect must run even when the same chip is tapped again.
    setChoice({ ...c });
  };

  // Caption tracks + default choice (preferred locale; YouTube auto-translation if needed).
  useEffect(() => {
    if (!loaded || hasSaved) return;
    getTranscriptInfo(id, settings.transcriptLang)
      .then((i) => {
        setInfo(i);
        if (!i.tracks.length) return setTrError(t().video.noSubtitles);
        const p = pickTrack(i, settings.transcriptLang);
        selectChoice({ languageCode: p.track.languageCode, tlang: p.tlang });
      })
      .catch((e) => setTrError(e.message));
  }, [id, loaded, hasSaved, settings.transcriptLang, infoAttempt]);

  useEffect(() => {
    if (!choice || hasSaved) return;
    let cancelled = false;
    const translation = choice.tlang ? getTranslation(id, choice.tlang) : undefined;
    (translation ? Promise.resolve(translation) : getTranscript(id, { ...choice, hl: settings.transcriptLang }))
      .then((t) => !cancelled && setTranscript(t))
      .catch((e) => !cancelled && setTrError(e.message))
      .finally(() => !cancelled && setTrLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, choice, hasSaved, settings.transcriptLang]);

  const { authored: hasChapters, parts } = useMemo(
    () => (video ? videoParts(video) : { authored: false, parts: [] as Chapter[] }),
    // Generated part titles are in the UI language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [video, s],
  );

  // Restore reviews: kept with the download, else still in the cache.
  useEffect(() => {
    if (!video) return;
    (async () => {
      const next: Record<string, ReviewState> = {};
      const kept = readSavedReviews(video.id);
      for (const t of [...parts.map((p) => p.index), 'all' as const]) {
        const text = kept[String(t)] ?? (await getCachedReview(video.id, t, settings.cacheTtlMin));
        if (text) next[String(t)] = { text };
      }
      setReviews((r) => ({ ...next, ...r }));
    })();
  }, [video, parts, settings.cacheTtlMin]);

  // The video may get downloaded while its reviews are already on the screen.
  useEffect(() => {
    if (!hasRecord) return;
    const done = Object.entries(reviews).flatMap(([target, r]) => (r.text ? [[target, r.text]] : []));
    saveReviews(id, Object.fromEntries(done));
  }, [id, hasRecord, reviews]);

  const seek = useCallback((sec: number) => {
    player.current?.seekTo(sec);
    setTime(sec); // highlight right away instead of waiting for the next player report
  }, []);

  const getAiTranscript = useCallback(async () => {
    // The first saved transcript is the original one.
    if (saved?.length) return saved[0];
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
  }, [id, info, saved, settings.transcriptLang, transcript, video?.defaultAudioLanguage]);

  const patchReview = (k: string, p: ReviewState) => setReviews((r) => ({ ...r, [k]: { ...r[k], ...p } }));

  const runReview = useCallback(
    async (target: number | 'all', force = false) => {
      if (!video) return;
      const k = String(target);
      if (reviews[k]?.loading) return;
      if (!force && reviews[k]?.text) return patchReview(k, { open: !reviews[k].open });
      patchReview(k, { loading: true, error: undefined, status: t().video.gettingTranscript, open: true });
      try {
        const tr = await getAiTranscript();
        patchReview(k, { status: tr ? t().video.generating : t().video.watching });
        const text = await generateReview({ video, chapters: parts, transcript: tr, target }, settings, (status) =>
          patchReview(k, { status }),
        );
        await setCachedReview(video.id, target, text, settings.cacheTtlMin);
        // Here too: the screen may be closed by now.
        saveReviews(video.id, { [k]: text });
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
  // A phone turned sideways shows only the player. Errors keep the full layout so their banner stays visible.
  const failed = playLocal ? fileError : playerError != null;
  const fullscreen = Platform.OS !== 'web' && width > height && height < 600 && !failed;
  const h = fullscreen
    ? height - insets.top - insets.bottom
    : Math.round(Platform.OS === 'web' ? (width * 9) / 16 : Math.min((width * 9) / 16, height / 2));

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
    if (m === 'transcript') setTranscriptOpened(true);
    setMode(m);
  };

  const trackOptions: TrackOption[] = useMemo(() => {
    if (!info) return [];
    const opts: TrackOption[] = info.tracks.map((track) => ({
      label: `${track.name}${track.isAuto && !/auto|авто/i.test(track.name) ? ` (${s.video.auto})` : ''}`,
      choice: { languageCode: track.languageCode },
    }));
    const want = settings.transcriptLang;
    const hasExact = info.tracks.some((t) => base(t.languageCode) === base(want));
    const src = info.tracks.find((t) => !t.isAuto && t.isTranslatable) ?? info.tracks.find((t) => t.isTranslatable);
    if (!hasExact && src && info.translationLanguages.some((l) => base(l.languageCode) === base(want)))
      opts.unshift({ label: s.video.translation(want), choice: { languageCode: src.languageCode, tlang: want } });
    return opts;
  }, [info, settings.transcriptLang, s]);

  const retryVideo = () => {
    setError(undefined);
    setVideoAttempt((n) => n + 1);
  };

  const retryTranscript = () => {
    forgetTranscriptInfo(id);
    // Keep the track the viewer picked.
    if (info && choice) return selectChoice(choice);
    setTrError(undefined);
    setInfoAttempt((n) => n + 1);
  };

  const savedCurrent =
    saved?.find((t) => sameChoice(t, choice)) ??
    saved?.find((t) => transcriptLangOf(t) === base(settings.transcriptLang)) ??
    saved?.[0];
  const savedOptions = saved?.map((t) => ({ label: savedLabel(t), choice: choiceOf(t) }));

  // Translation by AI is offered when the wanted language could not be had otherwise.
  const shown = savedCurrent ?? transcript;
  const savedMissing = hasSaved && !saved.some((t) => transcriptLangOf(t) === base(settings.transcriptLang));
  const wantedLang = hasSaved
    ? savedMissing
      ? base(settings.transcriptLang)
      : undefined
    : !trLoading && !trError && !transcript?.translatedTo
      ? choice?.tlang
      : undefined;
  // Kept here, not in the panel: translating goes on while another mode is open.
  const notice = useAiTranslation({
    videoId: id,
    source: wantedLang ? shown : undefined,
    lang: wantedLang,
    settings,
    onTranslated: (result) => {
      addTranscript(id, result);
      // Show it, unless another track has been picked meanwhile.
      if (hasSaved) setChoice(choiceOf(result));
      else setChoice((c) => (c?.tlang === result.translatedTo ? { ...c! } : c));
    },
  });

  const playLocalFromHere = () => {
    setFileError(false);
    setPlayerError(undefined);
    setLocal({ startSec: time });
  };

  const removeDownload = () => {
    deleteDownload(id);
    setLocal(undefined);
  };

  return (
    <View
      style={[
        styles.screen,
        fullscreen && styles.fullscreen,
        fullscreen && { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <Stack.Screen options={{ title: video?.title ?? title ?? '', headerShown: !fullscreen }} />
      <StatusBar hidden={fullscreen} style="auto" />
      {playLocal ? (
        <LocalPlayer
          ref={player}
          uri={videoUri(record)}
          height={h}
          startSec={local.startSec}
          onTime={setTime}
          onError={() => setFileError(true)}
        />
      ) : (
        <YouTubePlayer ref={player} videoId={id} height={h} onTime={setTime} onError={setPlayerError} />
      )}
      {playLocal && fileError && (
        <View style={styles.banner}>
          <Banner tone="error" text={s.video.fileError} />
        </View>
      )}
      {!playLocal && playerError != null && (
        <View style={styles.banner}>
          <Banner
            tone="warn"
            text={playerErrorText(playerError)}
            actionLabel={s.video.openInYouTube}
            onAction={() => Linking.openURL(`https://www.youtube.com/watch?v=${id}&t=${Math.floor(time)}s`)}
          />
        </View>
      )}

      <View style={fullscreen ? styles.hidden : styles.content}>
        {video && (
          <DownloadBar
            video={video}
            record={record}
            playingFile={playLocal}
            onPlayFile={playLocalFromHere}
            onDelete={removeDownload}
          />
        )}

        <View style={[styles.panel, { paddingLeft: insets.left, paddingRight: insets.right }]}>
          <View style={styles.layers}>
            {mode === 'transcript' ? null : error && !video ? (
              <ScrollView>
                <StateView icon="alert" tone="error" title={s.video.loadFailed} message={errorText(error)}>
                  {/key|ключ/i.test(error) && (
                    <Button icon="settings" label={s.common.openSettings} onPress={() => router.push('/settings')} />
                  )}
                  <Button variant="secondary" icon="refresh" label={s.common.retry} onPress={retryVideo} />
                </StateView>
              </ScrollView>
            ) : !video ? (
              <StateView loading message={s.video.loading} />
            ) : mode === 'ai' ? (
              <AiPanel
                chapters={parts}
                authored={hasChapters}
                currentIndex={currentIdx}
                time={time}
                reviews={reviews}
                runningAll={runningAll}
                focusIndex={aiFocus}
                onRunAll={runAllChapters}
                onReview={review}
                onSeek={seek}
              />
            ) : mode === 'about' ? (
              <AboutPanel video={video} onSeek={seek} />
            ) : null}
            {/* Kept mounted: coming back must not scroll through the list from its start. */}
            {video && (
              <Layer active={mode === 'chapters'}>
                <ChaptersPanel
                  chapters={parts}
                  authored={hasChapters}
                  currentIndex={currentIdx}
                  time={time}
                  reviews={reviews}
                  onSeek={seek}
                  onReview={reviewFromChapters}
                />
              </Layer>
            )}
            {transcriptOpened && (
              <Layer active={mode === 'transcript'}>
                <TranscriptPanel
                  transcript={shown}
                  loading={!hasSaved && trLoading}
                  error={hasSaved ? undefined : trError}
                  options={savedOptions?.length ? savedOptions : trackOptions}
                  choice={savedCurrent ? choiceOf(savedCurrent) : choice}
                  time={time}
                  onChoose={hasSaved ? setChoice : selectChoice}
                  onSeek={seek}
                  // Nothing to retry when YouTube says the video has no captions at all.
                  onRetry={info && !info.tracks.length ? undefined : retryTranscript}
                  notice={notice}
                />
              </Layer>
            )}
          </View>
        </View>

        <ModeBar mode={mode} onChange={changeMode} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  // Panels use the full height; in portrait on tablets the column stays readable.
  panel: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  // Inside the safe-area padding of the panel: layers are positioned absolutely.
  layers: { flex: 1 },
  fullscreen: { backgroundColor: '#000' },
  hidden: { display: 'none' },
  banner: { paddingHorizontal: space.md, paddingTop: space.sm },
});
