import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, TOUCH } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  /** read by screen readers, so required */
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  testID?: string;
};

export function IconButton({ icon, label, onPress, color = colors.text, size = 22, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      role="button"
      aria-label={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: TOUCH - 4, height: TOUCH - 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfacePressed },
});
