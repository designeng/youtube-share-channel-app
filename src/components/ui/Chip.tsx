import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
  /** "checkbox" for multi-select groups; shows a tick when on */
  role?: 'button' | 'checkbox';
};

export function Chip({ label, active, onPress, role = 'button' }: Props) {
  const checkbox = role === 'checkbox';
  return (
    <Pressable
      role={role}
      aria-checked={checkbox ? active : undefined}
      aria-selected={checkbox ? undefined : active}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}
    >
      {checkbox && active && <Icon name="check" size={14} color={colors.onPrimary} />}
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.65 },
  text: { fontSize: 13, fontWeight: '600', color: colors.text },
  textActive: { color: colors.onPrimary },
});
