import { View } from 'react-native';
import { radius, themed } from '../theme';

/** value is 0..1 */
export function ProgressBar({ value }: { value: number }) {
  const styles = useStyles();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} style={styles.track}>
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const useStyles = themed((colors) => ({
  track: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfacePressed, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.accent },
}));
