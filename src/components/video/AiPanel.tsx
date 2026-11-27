import { useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { formatTime } from '../../lib/format';
import type { Chapter } from '../../lib/types';
import { Markdown } from '../Markdown';
import { colors } from '../theme';
import { shared } from './styles';

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

  return (
    <ScrollView ref={scroll} testID="panel-ai" contentContainerStyle={shared.body}>
      <View style={styles.buttons}>
        <Pressable testID="ai-overview" style={styles.btn} onPress={() => onReview('all')}>
          <Text style={styles.btnText}>Общий обзор</Text>
        </Pressable>
        <Pressable
          testID="ai-run-all"
          style={[styles.btn, styles.btnSecondary, runningAll && styles.btnStop]}
          onPress={onRunAll}
        >
          <Text style={[styles.btnText, !runningAll && { color: colors.text }]}>
            {runningAll ? 'Остановить' : `Все ${authored ? 'главы' : 'части'} по очереди`}
          </Text>
        </Pressable>
      </View>
      <ReviewBlock state={reviews.all} onTime={onSeek} onRetry={() => onReview('all', true)} />

      {chapters.map((c) => {
        const r = reviews[String(c.index)];
        return (
          <View
            key={c.index}
            style={[shared.chapter, currentIndex === c.index && shared.chapterActive]}
            onLayout={
              focusIndex === c.index
                ? (e) => scroll.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false })
                : undefined
            }
          >
            <View style={shared.chapterRow}>
              <Pressable onPress={() => onSeek(c.start)} style={shared.chapterMain}>
                <Text style={shared.time}>{formatTime(c.start)}</Text>
                <Text style={shared.chTitle}>{c.title}</Text>
              </Pressable>
              <Pressable
                testID={`ai-chapter-${c.index}`}
                onPress={() => onReview(c.index)}
                style={[shared.aiChip, r?.text && shared.aiChipDone]}
                hitSlop={6}
              >
                <Text style={[shared.aiChipText, r?.text && shared.aiChipTextDone]}>
                  {r?.loading ? '…' : r?.text ? (r.open ? 'AI ▾' : 'AI ▸') : 'AI'}
                </Text>
              </Pressable>
            </View>
            <ReviewBlock state={r} onTime={onSeek} onRetry={() => onReview(c.index, true)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function ReviewBlock({ state, onTime, onRetry }: { state?: ReviewState; onTime: (s: number) => void; onRetry: () => void }) {
  if (!state?.open && !state?.loading && !state?.error) return null;
  return (
    <View style={styles.review}>
      {state.loading && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
          <Text style={shared.hint}>{state.status ?? 'Думаю…'}</Text>
        </View>
      )}
      {state.error && (
        <>
          <Text style={shared.error}>{state.error}</Text>
          <Pressable onPress={onRetry}>
            <Text style={shared.link}>Повторить</Text>
          </Pressable>
        </>
      )}
      {state.text && state.open && !state.loading && (
        <>
          <Markdown text={state.text} onTime={onTime} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
            <Pressable onPress={() => Share.share({ message: state.text! })}>
              <Text style={shared.link}>Поделиться</Text>
            </Pressable>
            <Pressable onPress={onRetry}>
              <Text style={shared.link}>Перегенерировать</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: colors.chipActive, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  btnSecondary: { backgroundColor: colors.card },
  btnStop: { backgroundColor: colors.accent },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  review: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginTop: 6, gap: 6 },
});
