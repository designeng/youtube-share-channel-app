import { router } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { errorText } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import type { Chapter } from '../../lib/types';
import { Markdown } from '../Markdown';
import { space, useColors, useType } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { AiButton, ChapterRow } from './ChapterRow';
import { useShared } from './styles';

export type ReviewState = { text?: string; loading?: boolean; status?: string; error?: string; open?: boolean };

type Props = {
  chapters: Chapter[];
  authored: boolean;
  currentIndex: number;
  reviews: Record<string, ReviewState>;
  runningAll: boolean;
  /** chapter to bring into view when the panel opens */
  focusIndex?: number;
  onRunAll: () => void;
  onReview: (target: number | 'all', force?: boolean) => void;
  onSeek: (sec: number) => void;
};

export function AiPanel(props: Props) {
  const { chapters, authored, currentIndex, reviews, runningAll, focusIndex, onRunAll, onReview, onSeek } = props;
  const scroll = useRef<ScrollViewInstance>(null);
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  const ready = chapters.filter((c) => reviews[String(c.index)]?.text).length;
  const untouched = Object.keys(reviews).length === 0;

  return (
    <ScrollView ref={scroll} testID="panel-ai" contentContainerStyle={shared.body}>
      <View style={styles.buttons}>
        <Button testID="ai-overview" icon="ai" label={s.ai.overview} onPress={() => onReview('all')} style={styles.button} />
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
      <ReviewBlock state={reviews.all} onTime={onSeek} onRetry={() => onReview('all', true)} />

      {chapters.map((c) => {
        const r = reviews[String(c.index)];
        return (
          <View
            key={c.index}
            onLayout={
              focusIndex === c.index
                ? (e) => scroll.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false })
                : undefined
            }
          >
            <ChapterRow chapter={c} active={currentIndex === c.index} onSeek={onSeek}>
              <AiButton
                testID={`ai-chapter-${c.index}`}
                label={s.ai.chapterReview(c.title)}
                onPress={() => onReview(c.index)}
                done={!!r?.text}
                loading={r?.loading}
                icon={r?.text ? (r.open ? 'chevronUp' : 'chevronDown') : undefined}
              />
            </ChapterRow>
            <ReviewBlock state={r} onTime={onSeek} onRetry={() => onReview(c.index, true)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function ReviewBlock({ state, onTime, onRetry }: { state?: ReviewState; onTime: (s: number) => void; onRetry: () => void }) {
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
          <Markdown text={state.text!} onTime={onTime} />
          <View style={styles.actions}>
            <Button small variant="ghost" icon="share" label={s.ai.share} onPress={() => Share.share({ message: state.text! })} />
            <Button small variant="ghost" icon="refresh" label={s.ai.regenerate} onPress={onRetry} />
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
