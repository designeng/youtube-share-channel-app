/**
 * Following playback: the current fragment is kept in view. Scrolling by hand pauses following
 * until the user taps a timecode or "back to current".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, type ScrollViewInstance, type ViewInstance } from 'react-native';
import { formatTime } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import { radius, space, themed, TOUCH, useColors } from '../theme';
import { Icon } from '../ui/Icon';

/** Where the current fragment sits on the screen: 0 = top, 1 = bottom. */
export const VIEW_POSITION = 0.3;

/**
 * Follow mode of a ScrollView: give `scrollProps` to it, `contentRef` to the single View inside it
 * and `targetRef` to the element being played. `targetKey` changes when that element does.
 */
export function useFollowScroll(targetKey: string | undefined, initialFollow = true) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const target = useRef<ViewInstance | null>(null);
  const height = useRef(0);
  const [follow, setFollow] = useState(initialFollow);
  const following = useRef(follow);

  const targetRef = useCallback((node: ViewInstance | null) => {
    target.current = node;
  }, []);

  const scrollToTarget = useCallback(() => {
    const content = contentRef.current;
    if (!following.current || !height.current || !content) return;
    target.current?.measureLayout(content, (_x, y) => {
      // The user may have scrolled while the element was being measured.
      if (following.current)
        scrollRef.current?.scrollTo({ y: Math.max(0, y - height.current * VIEW_POSITION), animated: true });
    });
  }, []);

  useEffect(() => {
    following.current = follow;
    scrollToTarget();
  }, [follow, targetKey, scrollToTarget]);

  const stopFollowing = useCallback(() => {
    following.current = false;
    setFollow(false);
  }, []);

  const resume = useCallback(() => setFollow(true), []);

  /** Stops following and puts `node` at the top. */
  const showAtTop = useCallback(
    (node: ViewInstance) => {
      stopFollowing();
      const content = contentRef.current;
      if (content) node.measureLayout(content, (_x, y) => scrollRef.current?.scrollTo({ y, animated: false }));
    },
    [stopFollowing],
  );

  // react-native-web does not emit drag events for wheel / touch scrolling.
  const webScrollProps: object = Platform.OS === 'web' ? { onWheel: stopFollowing, onTouchMove: stopFollowing } : {};

  return {
    follow,
    resume,
    stopFollowing,
    showAtTop,
    contentRef,
    targetRef,
    scrollProps: {
      ref: scrollRef,
      onScrollBeginDrag: stopFollowing,
      // The target moves when the panel is first laid out or a review appears above it.
      onLayout: (e: { nativeEvent: { layout: { height: number } } }) => {
        height.current = e.nativeEvent.layout.height;
        scrollToTarget();
      },
      onContentSizeChange: scrollToTarget,
      ...webScrollProps,
    },
  };
}

export function FollowButton({ testID, time, onPress }: { testID: string; time: number; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const s = useStrings();
  return (
    <Pressable testID={testID} role="button" style={styles.button} onPress={onPress}>
      <Icon name="follow" size={18} color={colors.onPrimary} />
      <Text style={styles.text}>{s.transcript.toCurrent(formatTime(time))}</Text>
    </Pressable>
  );
}

const useStyles = themed((colors) => ({
  button: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: TOUCH,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    boxShadow: '0 4px 12px rgba(0,0,0,0.22)',
  },
  text: { color: colors.onPrimary, fontWeight: '600', fontSize: 13, fontVariant: ['tabular-nums'] },
}));
