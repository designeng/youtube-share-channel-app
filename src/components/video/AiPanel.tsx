import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { currentTimecode } from '../../lib/chapters';
import { errorText } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import type { Chapter } from '../../lib/types';
import { Markdown } from '../Markdown';
import { space, useColors, useType } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { AiButton, ChapterRow } from './ChapterRow';
import { FollowButton, useFollowScroll } from './follow';
import { ReportDialog } from './ReportDialog';
import { useShared } from './styles';

export type ReviewState = { text?: string; loading?: boolean; status?: string; error?: string; open?: boolean };

type Props = {
  videoId: string;
  chapters: Chapter[];
  authored: boolean;
  currentIndex: number;
  time: number;
  reviews: Record<string, ReviewState>;
  runningAll: boolean;
  /** chapter to bring into view, set when it was asked for from the timecodes */
  focusIndex?: number;
  onRunAll: () => void;
  onReview: (target: number | 'all', force?: boolean) => void;
  onSeek: (sec: number) => void;
};

export function AiPanel(props: Props) {
  const { videoId, chapters, authored, currentIndex, time, reviews, runningAll, focusIndex, onRunAll, onReview, onSeek } = props;
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  /** the review being complained about */
  const [reported, setReported] = useState<{ target: string; text: string }>();
  const ready = chapters.filter((c) => reviews[String(c.index)]?.text).length;
  const untouched = Object.keys(reviews).length === 0;

  // The moment being played within each open review.
  const shown = (r?: ReviewState) => (r?.open && !r.loading ? r.text : undefined);
  const overviewText = shown(reviews.all);
  const overviewSec = overviewText ? currentTimecode(overviewText, time) : undefined;
  const chapter = chapters.find((c) => c.index === currentIndex);
  const chapterText = chapter && shown(reviews[String(chapter.index)]);
  const chapterSec = chapterText ? currentTimecode(chapterText, time, chapter.start, chapter.end) : undefined;

  // What to keep in view: a point of the chapter's review, else of the overview, else the chapter itself.
  const target =
    chapterSec !== undefined
      ? `point:${currentIndex}:${chapterSec}`
      : overviewSec !== undefined
        ? `overview:${overviewSec}`
        : chapter
          ? `row:${currentIndex}`
          : undefined;
  // Opened on a particular chapter: stay there instead of jumping to the one being played.
  const { follow, resume, stopFollowing, showAtTop, contentRef, targetRef, scrollProps } = useFollowScroll(
    target,
    focusIndex === undefined,
  );
  // Also when the panel is already mounted: it stays so while other modes are shown.
  const rows = useRef(new Map<number, ViewInstance | null>());
  useEffect(() => {
    const row = focusIndex === undefined ? undefined : rows.current.get(focusIndex);
    if (row) showAtTop(row);
  }, [focusIndex, showAtTop]);
  const seek = (sec: number) => {
    onSeek(sec);
    resume();
  };
  // Opening a review means the viewer is going to read it.
  const openReview = (t: number | 'all', force?: boolean) => {
    stopFollowing();
    onReview(t, force);
  };

  return (
    <View testID="panel-ai" style={shared.fill}>
      <ScrollView testID="ai-list" {...scrollProps}>
        <View ref={contentRef} style={shared.body}>
          <View style={styles.buttons}>
            <Button testID="ai-overview" icon="ai" label={s.ai.overview} onPress={() => openReview('all')} style={styles.button} />
            {chapters.length > 0 && (
              <Button
                testID="ai-run-all"
                variant="secondary"
                icon={runningAll ? 'stop' : undefined}
                label={runningAll ? s.ai.stop : s.ai.runAll(authored)}
                onPress={onRunAll}
                style={styles.button}
              />
            )}
          </View>
          {(runningAll || ready > 0) && (
            <Text style={[type.caption, styles.caption]}>
              {s.ai.ready(ready, chapters.length)}
            </Text>
          )}
          {untouched && (
            <Text style={[type.caption, styles.caption]}>
              {s.ai.intro}
            </Text>
          )}
          <ReviewBlock
            state={reviews.all}
            onTime={seek}
            onReport={(text) => setReported({ target: 'all', text })}
            onRetry={() => openReview('all', true)}
            activeSec={overviewSec}
            activeRef={target?.startsWith('overview:') ? targetRef : undefined}
          />

          {chapters.map((c) => {
            const r = reviews[String(c.index)];
            const active = currentIndex === c.index;
            return (
              <View
                key={c.index}
                ref={(node) => {
                  rows.current.set(c.index, node);
                }}
              >
                <View
                  ref={active && target?.startsWith('row:') ? targetRef : undefined}
                  testID={`ai-row-${c.index}`}
                  aria-selected={active}
                >
                  <ChapterRow chapter={c} active={active} onSeek={seek}>
                    <AiButton
                      testID={`ai-chapter-${c.index}`}
                      label={s.ai.chapterReview(c.title)}
                      onPress={() => openReview(c.index)}
                      done={!!r?.text}
                      loading={r?.loading}
                      icon={r?.text ? (r.open ? 'chevronUp' : 'chevronDown') : undefined}
                    />
                  </ChapterRow>
                </View>
                <ReviewBlock
                  state={r}
                  onTime={seek}
                  onReport={(text) => setReported({ target: String(c.index), text })}
                  onRetry={() => openReview(c.index, true)}
                  activeSec={active ? chapterSec : undefined}
                  activeRef={active && target?.startsWith('point:') ? targetRef : undefined}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
      {!follow && target !== undefined && <FollowButton testID="ai-follow" time={time} onPress={resume} />}
      {reported && <ReportDialog videoId={videoId} {...reported} onClose={() => setReported(undefined)} />}
    </View>
  );
}

type ReviewProps = {
  state?: ReviewState;
  onTime: (s: number) => void;
  onRetry: () => void;
  onReport: (text: string) => void;
  activeSec?: number;
  activeRef?: (node: ViewInstance | null) => void;
};

function ReviewBlock({ state, onTime, onRetry, onReport, activeSec, activeRef }: ReviewProps) {
  const colors = useColors();
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  if (!state?.open && !state?.loading && !state?.error) return null;
  const needsKey = /key|ключ/i.test(state.error ?? '');
  const showText = !!state.text && !!state.open && !state.loading;
  return (
    <View style={styles.review}>
      {state.loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={[type.caption, { flex: 1 }]}>{state.status ?? s.ai.thinking}</Text>
        </View>
      )}
      {state.error && (
        <>
          <Banner tone="error" text={errorText(state.error)} />
          <View style={styles.actions}>
            <Button small variant="secondary" icon="refresh" label={s.common.retry} onPress={onRetry} />
            {needsKey && (
              <Button small variant="secondary" icon="settings" label={s.common.settings} onPress={() => router.push('/settings')} />
            )}
          </View>
        </>
      )}
      {showText && (
        <View style={shared.card}>
          <Markdown text={state.text!} onTime={onTime} activeSec={activeSec} activeRef={activeRef} />
          <View style={styles.actions}>
            <Button small variant="ghost" icon="share" label={s.ai.share} onPress={() => Share.share({ message: state.text! })} />
            <Button small variant="ghost" icon="refresh" label={s.ai.regenerate} onPress={onRetry} />
            <Button small variant="ghost" icon="flag" label={s.report.button} onPress={() => onReport(state.text!)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  button: { flexGrow: 1 },
  caption: { paddingHorizontal: space.sm },
  review: { marginVertical: space.xs, gap: space.sm },
  loading: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
