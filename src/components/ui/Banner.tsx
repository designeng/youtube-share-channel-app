/** Inline notice above the content it is about. */
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warn' | 'error';

const TONE: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.surface, fg: colors.muted, icon: 'info' },
  warn: { bg: colors.warnBg, fg: colors.warnText, icon: 'alert' },
  error: { bg: colors.accentSoft, fg: colors.danger, icon: 'alert' },
};

type Props = {
  tone?: Tone;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Banner({ tone = 'info', text, actionLabel, onAction }: Props) {
  const { bg, fg, icon } = TONE[tone];
  return (
    <View role={tone === 'error' ? 'alert' : undefined} style={[styles.banner, { backgroundColor: bg }]}>
      <Icon name={icon} size={18} color={fg} />
      <View style={styles.body}>
        <Text style={[styles.text, { color: fg }]}>{text}</Text>
        {actionLabel && onAction && <Button small variant="ghost" label={actionLabel} onPress={onAction} style={styles.action} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md },
  body: { flex: 1, alignItems: 'flex-start', gap: space.xs },
  text: { fontSize: 13, lineHeight: 18 },
  action: { paddingHorizontal: 0, minHeight: 28 },
});
