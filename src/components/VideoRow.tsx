import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatDate, formatTime } from '../lib/format';
import type { VideoItem } from '../lib/types';
import { colors } from './theme';

export const VideoRow = memo(function VideoRow({ item, onPress }: { item: VideoItem; onPress: (v: VideoItem) => void }) {
  return (
    <Pressable onPress={() => onPress(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={styles.thumbWrap}>
        <Image source={item.thumbnail} style={styles.thumb} contentFit="cover" transition={150} recyclingKey={item.id} />
        {item.durationSec ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatTime(item.durationSec)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={3}>
          {item.title}
        </Text>
        <Text style={styles.sub}>
          {formatDate(item.publishedAt)}
          {item.viewCount != null ? ` · ${formatCount(item.viewCount)} просм.` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 12 },
  thumbWrap: { width: 160, aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border },
  thumb: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
});
