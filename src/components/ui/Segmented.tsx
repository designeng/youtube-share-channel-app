/** One choice out of a few equal options. */
import { Pressable, Text, View } from 'react-native';
import { radius, themed } from '../theme';

type Props<T extends string> = {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const styles = useStyles();
  return (
    <View role="tablist" style={styles.track}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            role="tab"
            aria-selected={active}
            onPress={() => onChange(o.key)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.item, active && styles.active, pressed && styles.pressed]}
          >
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1} adjustsFontSizeToFit>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = themed((colors) => ({
  track: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3 },
  // Sized by content first, so a long label gets more room than a short one.
  item: { flexGrow: 1, minHeight: 36, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  active: { backgroundColor: colors.raised, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  pressed: { opacity: 0.65 },
  text: { fontSize: 13, fontWeight: '600', color: colors.muted },
  textActive: { color: colors.text },
}));
