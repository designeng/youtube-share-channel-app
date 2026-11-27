import { Image, type ImageProps } from 'expo-image';
import { Text, useWindowDimensions, View } from 'react-native';
import { formatTime } from '../lib/format';
import { radius, themed } from './theme';

type Props = { source: ImageProps['source']; durationSec?: number; recyclingKey?: string };

/** 16:9 preview that scales with the screen, with the duration in the corner. */
export function Thumbnail({ source, durationSec, recyclingKey }: Props) {
  const { width } = useWindowDimensions();
  const styles = useStyles();
  return (
    <View style={[styles.wrap, { width: Math.round(Math.min(168, width * 0.38)) }]}>
      <Image source={source} style={styles.image} contentFit="cover" transition={150} recyclingKey={recyclingKey} />
      {durationSec ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatTime(durationSec)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themed((colors) => ({
  wrap: { aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
}));
