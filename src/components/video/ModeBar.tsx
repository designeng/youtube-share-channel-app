import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export type Mode = 'chapters' | 'transcript' | 'ai' | 'about';

const MODES: { key: Mode; icon: string; label: string }[] = [
  { key: 'chapters', icon: '⏱', label: 'Таймкоды' },
  { key: 'transcript', icon: '📝', label: 'Транскрипт' },
  { key: 'ai', icon: '✨', label: 'AI-обзор' },
  { key: 'about', icon: 'ℹ️', label: 'Описание' },
];

/** Bottom bar switching what is shown under the player. */
export function ModeBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View role="tablist" style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {MODES.map((m) => {
        const active = m.key === mode;
        return (
          <Pressable
            key={m.key}
            testID={`mode-${m.key}`}
            role="tab"
            aria-selected={active}
            aria-label={m.label}
            style={styles.item}
            onPress={() => onChange(m.key)}
          >
            <View style={[styles.iconWrap, active && styles.iconActive]}>
              <Text style={styles.icon}>{m.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.bg },
  item: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 2, minHeight: 56 },
  iconWrap: { paddingHorizontal: 16, paddingVertical: 2, borderRadius: 14 },
  iconActive: { backgroundColor: colors.activeBg },
  icon: { fontSize: 18 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  labelActive: { color: colors.text, fontWeight: '700' },
});
