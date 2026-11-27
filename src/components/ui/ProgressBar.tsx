import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

/** value is 0..1 */
export function ProgressBar({ value }: { value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfacePressed, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.accent },
});
