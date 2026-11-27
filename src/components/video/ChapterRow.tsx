/** A timecode with its title and the button that asks AI about it. */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { formatTime } from '../../lib/format';
import type { Chapter } from '../../lib/types';
import { radius, space, themed, TOUCH, useColors, useType } from '../theme';
import { Icon, type IconName } from '../ui/Icon';
import { useShared } from './styles';

type RowProps = { chapter: Chapter; active: boolean; onSeek: (sec: number) => void; children: ReactNode };

export function ChapterRow({ chapter, active, onSeek, children }: RowProps) {
  const type = useType();
  const shared = useShared();
  const styles = useStyles();
  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <Pressable
        role="button"
        onPress={() => onSeek(chapter.start)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Text style={shared.time}>{formatTime(chapter.start)}</Text>
        <Text style={[type.body, styles.title, active && styles.titleActive]}>{chapter.title}</Text>
      </Pressable>
      {children}
    </View>
  );
}

type AiButtonProps = {
  testID: string;
  label: string;
  onPress: () => void;
  /** a review exists */
  done: boolean;
  loading?: boolean;
  /** trailing icon, e.g. the open / closed state of the review */
  icon?: IconName;
};

export function AiButton({ testID, label, onPress, done, loading, icon }: AiButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const color = done ? colors.onPrimary : colors.text;
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-label={label}
      aria-busy={loading}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.ai, done && styles.aiDone, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          <Text style={[styles.aiText, { color }]}>AI</Text>
          {icon && <Icon name={icon} size={14} color={color} />}
        </>
      )}
    </Pressable>
  );
}

const useStyles = themed((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderColor: 'transparent',
  },
  rowActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    minHeight: TOUCH + 4,
    paddingVertical: 13,
    paddingLeft: space.sm,
  },
  title: { flex: 1 },
  titleActive: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  ai: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 48,
    height: 32,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  aiDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  aiText: { fontSize: 12, fontWeight: '700' },
}));
