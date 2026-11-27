/**
 * Transcript that follows playback: the line being spoken is highlighted and kept in view.
 * Scrolling by hand pauses following until the user taps a line or "back to current".
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type FlatListInstance,
} from 'react-native';
import { lineIndexAt, transcriptLines, type TranscriptLine } from '../../lib/chapters';
import { formatTime } from '../../lib/format';
import type { Transcript } from '../../lib/types';
import { colors } from '../theme';
import { shared } from './styles';

export type TrackChoice = { languageCode: string; tlang?: string };
export type TrackOption = { label: string; choice: TrackChoice };

/** Short lines keep the highlight close to what is being said. */
const LINE_SEC = 10;
/** Where the current line sits in the list: 0 = top, 1 = bottom. */
const VIEW_POSITION = 0.3;
const MAX_SCROLL_RETRIES = 10;

type Props = {
  transcript?: Transcript;
  loading: boolean;
  error?: string;
  options: TrackOption[];
  choice?: TrackChoice;
  time: number;
  onChoose: (c: TrackChoice) => void;
  onSeek: (sec: number) => void;
};

const Line = memo(function Line({
  line,
  index,
  active,
  onPress,
}: {
  line: TranscriptLine;
  index: number;
  active: boolean;
  onPress: (line: TranscriptLine) => void;
}) {
  return (
    <Pressable
      testID={`transcript-line-${index}`}
      role="button"
      aria-selected={active}
      onPress={() => onPress(line)}
      style={[styles.line, active && styles.lineActive]}
    >
      <Text style={shared.time}>{formatTime(line.start)}</Text>
      <Text style={styles.text}>{line.text}</Text>
    </Pressable>
  );
});

export function TranscriptPanel({ transcript, loading, error, options, choice, time, onChoose, onSeek }: Props) {
  const list = useRef<FlatListInstance>(null);
  const [follow, setFollow] = useState(true);
  const following = useRef(follow);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retries = useRef(0);

  const lines = useMemo(() => (transcript ? transcriptLines(transcript.segments, LINE_SEC) : []), [transcript]);
  const current = lineIndexAt(lines, time);
  const visible = !loading && lines.length > 0;

  const scrollTo = useCallback((index: number) => {
    list.current?.scrollToIndex({ index, viewPosition: VIEW_POSITION, animated: true });
  }, []);

  useEffect(() => {
    following.current = follow;
    clearTimeout(retry.current);
    retries.current = 0;
    if (follow && visible && current >= 0) scrollTo(current);
  }, [follow, visible, current, lines, scrollTo]);

  useEffect(() => () => clearTimeout(retry.current), []);

  const stopFollowing = useCallback(() => {
    following.current = false;
    clearTimeout(retry.current);
    setFollow(false);
  }, []);

  const pressLine = useCallback(
    (line: TranscriptLine) => {
      onSeek(line.start);
      setFollow(true);
    },
    [onSeek],
  );

  // Rows have different heights, so a far-away line is not measured yet: jump close, then retry.
  const onScrollToIndexFailed = ({ index, averageItemLength }: { index: number; averageItemLength: number }) => {
    if (retries.current++ >= MAX_SCROLL_RETRIES) return;
    list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
    clearTimeout(retry.current);
    retry.current = setTimeout(() => following.current && scrollTo(index), 100);
  };

  // react-native-web does not emit drag events for wheel / touch scrolling.
  const webScrollProps: object = Platform.OS === 'web' ? { onWheel: stopFollowing, onTouchMove: stopFollowing } : {};

  return (
    <View testID="panel-transcript" style={styles.panel}>
      {options.length > 0 && (
        <ScrollView horizontal style={styles.chipsRow} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {options.map((o) => {
            const active = choice?.languageCode === o.choice.languageCode && choice?.tlang === o.choice.tlang;
            return (
              <Pressable key={o.label} onPress={() => onChoose(o.choice)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {transcript?.translationFailed && (
        <Text style={[shared.hint, styles.notice]}>
          YouTube ограничил автоперевод субтитров (лимит запросов) — показан оригинал. AI-обзор всё равно будет на
          выбранном языке.
        </Text>
      )}
      {error && !loading && <Text style={[shared.hint, styles.notice]}>{error}</Text>}
      {(loading || (!transcript && !error)) && <ActivityIndicator style={{ margin: 12 }} />}
      {visible && (
        <View style={styles.listWrap}>
          <FlatList
            ref={list}
            testID="transcript-list"
            data={lines}
            extraData={current}
            keyExtractor={(l, i) => `${i}:${l.start}`}
            renderItem={({ item, index }) => (
              <Line line={item} index={index} active={index === current} onPress={pressLine} />
            )}
            contentContainerStyle={styles.content}
            initialNumToRender={20}
            onScrollBeginDrag={stopFollowing}
            onScrollToIndexFailed={onScrollToIndexFailed}
            {...webScrollProps}
          />
          {!follow && current >= 0 && (
            <Pressable testID="transcript-follow" role="button" style={styles.followBtn} onPress={() => setFollow(true)}>
              <Text style={styles.followText}>К текущему моменту · {formatTime(time)}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  chipsRow: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.chipActive },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  notice: { paddingHorizontal: 12, paddingBottom: 6 },
  listWrap: { flex: 1 },
  content: { paddingHorizontal: 8, paddingBottom: 72 },
  line: { flexDirection: 'row', gap: 8, padding: 8, borderRadius: 8, borderLeftWidth: 3, borderColor: 'transparent' },
  lineActive: { backgroundColor: colors.activeBg, borderColor: colors.accent },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  followBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: colors.chipActive,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  followText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
