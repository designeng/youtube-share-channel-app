/** Text field with an optional leading icon and trailing control (clear, show password…). */
import { useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useStrings } from '../../lib/i18n';
import { radius, space, themed, TOUCH, useColors } from '../theme';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

type Props = TextInputProps & {
  icon?: IconName;
  /** shows a clear button while there is text */
  onClear?: () => void;
  trailing?: ReactNode;
  invalid?: boolean;
};

export function Input({ icon, onClear, trailing, invalid, style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const colors = useColors();
  const styles = useStyles();
  const s = useStrings();
  return (
    <View style={[styles.box, focused && styles.focused, invalid && styles.invalid]}>
      {icon && <Icon name={icon} size={18} color={colors.faint} />}
      <TextInput
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, style]}
      />
      {onClear && !!props.value && <IconButton icon="close" label={s.common.clear} size={18} color={colors.muted} onPress={onClear} />}
      {trailing}
    </View>
  );
}

const useStyles = themed((colors) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: TOUCH + 4,
    paddingLeft: space.md,
    paddingRight: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  focused: { borderColor: colors.text },
  invalid: { borderColor: colors.danger },
  // The box shows focus, so the browser outline is redundant.
  input: { flex: 1, minWidth: 0, fontSize: 15, color: colors.text, paddingVertical: space.sm, outlineColor: 'transparent' },
}));
