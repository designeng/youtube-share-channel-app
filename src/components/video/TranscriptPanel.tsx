/**
 * Transcript that follows playback: the line being spoken is highlighted and kept in view.
 * Scrolling by hand pauses following until the user taps a line or "back to current".
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type FlatListInstance,
} from 'react-native';
import { lineIndexAt, transcriptLines, type TranscriptLine } from '../../lib/chapters';
import { errorText, formatTime } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import type { Transcript } from '../../lib/types';
import { radius, space, themed, useType } from '../theme';
import { Banner } from '../ui/Banner';
import { Chip } from '../ui/Chip';
import { StateView } from '../ui/StateView';
import { FollowButton, VIEW_POSITION } from './follow';
import { useShared } from './styles';

export type TrackChoice = { languageCode: string; tlang?: string };
export type TrackOption = { label: string; choice: TrackChoice };

/** Short lines keep the highlight close to what is being said. */
const LINE_SEC = 10;
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
  /** absent when trying again cannot help */
  onRetry?: () => void;
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
  const type = useType();
  const shared = useShared();
  const styles = useStyles();
  return (
    <Pressable
      testID={`transcript-line-${index}`}
      role="button"
      aria-selected={active}
      onPress={() => onPress(line)}
      style={({ pressed }) => [styles.line, active && styles.lineActive, pressed && styles.pressed]}
    >
      <Text style={shared.time}>{formatTime(line.start)}</Text>
      <Text style={[type.body, styles.text]}>{line.text}</Text>
    </Pressable>
  );
});

export function TranscriptPanel({ transcript, loading, error, options, choice, time, onChoose, onSeek, onRetry }: Props) {
  const shared = useShared();
  const styles = useStyles();
  const s = useStrings();
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
        <ScrollView horizontal style={styles.chipsRow} showsHorizontalScrollIndicator={false} contentContainerStyle={shared.chips}>
          {options.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              active={choice?.languageCode === o.choice.languageCode && choice?.tlang === o.choice.tlang}
              onPress={() => onChoose(o.choice)}
            />
          ))}
        </ScrollView>
      )}
      {transcript?.translationFailed && (
        <View style={styles.notice}>
          <Banner
            tone="warn"
            text={s.transcript.translationLimited}
          />
        </View>
      )}
      {error && !loading && (
        <View style={styles.notice}>
          <Banner tone="error" text={errorText(error)} actionLabel={onRetry ? s.common.retry : undefined} onAction={onRetry} />
        </View>
      )}
      {(loading || (!transcript && !error)) && <StateView loading message={s.transcript.loading} />}
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
            <FollowButton testID="transcript-follow" time={time} onPress={() => setFollow(true)} />
          )}
        </View>
      )}
    </View>
  );
}

const useStyles = themed((colors) => ({
  panel: { flex: 1 },
  chipsRow: { flexGrow: 0 },
  notice: { paddingHorizontal: space.md, paddingVertical: space.xs },
  listWrap: { flex: 1 },
  content: { paddingHorizontal: space.md, paddingBottom: 72 },
  line: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderColor: 'transparent',
  },
  lineActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  pressed: { opacity: 0.6 },
  text: { flex: 1 },
}));
