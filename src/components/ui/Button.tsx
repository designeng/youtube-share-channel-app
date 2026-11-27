import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, TOUCH } from '../theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** small buttons sit inside rows and bars; their touch area is extended */
  small?: boolean;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const TONE: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.surface, fg: colors.text },
  ghost: { bg: 'transparent', fg: colors.link },
  danger: { bg: 'transparent', fg: colors.danger },
};

export function Button({ label, onPress, variant = 'primary', small, icon, loading, disabled, testID, style }: Props) {
  const { bg, fg } = TONE[variant];
  const flat = variant === 'ghost' || variant === 'danger';
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-busy={loading}
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={small ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: bg },
        flat && styles.flat,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <View>
          <Icon name={icon} size={small ? 16 : 18} color={fg} />
        </View>
      ) : null}
      <Text style={[styles.label, small && styles.labelSmall, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  small: { minHeight: 34, borderRadius: radius.pill, paddingHorizontal: space.md, gap: 6 },
  flat: { paddingHorizontal: space.sm },
  label: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  labelSmall: { fontSize: 13 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});
