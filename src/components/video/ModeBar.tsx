import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStrings } from '../../lib/i18n';
import { radius, themed, useColors } from '../theme';
import { Icon, type IconName } from '../ui/Icon';

export type Mode = 'chapters' | 'transcript' | 'ai' | 'about';

const MODES: { key: Mode; icon: IconName }[] = [
  { key: 'chapters', icon: 'chapters' },
  { key: 'transcript', icon: 'transcript' },
  { key: 'ai', icon: 'ai' },
  { key: 'about', icon: 'info' },
];

/** Bottom bar switching what is shown under the player. */
export function ModeBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useStyles();
  const s = useStrings();
  return (
    <View
      role="tablist"
      style={[styles.bar, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}
    >
      {MODES.map((m) => {
        const active = m.key === mode;
        const label = s.video.modes[m.key];
        return (
          <Pressable
            key={m.key}
            testID={`mode-${m.key}`}
            role="tab"
            aria-selected={active}
            aria-label={label}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => onChange(m.key)}
          >
            <View style={[styles.iconWrap, active && styles.iconActive]}>
              <Icon name={m.icon} size={22} color={active ? colors.text : colors.muted} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themed((colors) => ({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.bg },
  item: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 6, gap: 3, minHeight: 58 },
  pressed: { opacity: 0.6 },
  iconWrap: { width: 56, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  iconActive: { backgroundColor: colors.surfacePressed },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  labelActive: { color: colors.text, fontWeight: '700' },
}));
