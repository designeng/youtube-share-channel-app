import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatDate } from '../lib/format';
import type { VideoItem } from '../lib/types';
import { colors, space, type } from './theme';
import { Thumbnail } from './Thumbnail';

export const VideoRow = memo(function VideoRow({ item, onPress }: { item: VideoItem; onPress: (v: VideoItem) => void }) {
  return (
    <Pressable
      role="button"
      onPress={() => onPress(item)}
      android_ripple={{ color: colors.surfacePressed }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Thumbnail source={item.thumbnail} durationSec={item.durationSec} recyclingKey={item.id} />
      <View style={styles.meta}>
        <Text style={type.label} numberOfLines={3}>
          {item.title}
        </Text>
        <Text style={type.micro}>
          {formatDate(item.publishedAt)}
          {item.viewCount != null ? ` · ${formatCount(item.viewCount)} просм.` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

/** Placeholder with the shape of a row while the first page loads. */
export function VideoRowSkeleton() {
  return (
    <View aria-hidden style={styles.row}>
      <View style={styles.boneThumb} />
      <View style={styles.meta}>
        <View style={[styles.bone, { width: '92%' }]} />
        <View style={[styles.bone, { width: '64%' }]} />
        <View style={[styles.bone, { width: '40%', height: 10 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  pressed: { backgroundColor: colors.surface },
  meta: { flex: 1, gap: 6 },
  boneThumb: { width: '38%', maxWidth: 168, aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: colors.surface },
  bone: { height: 13, borderRadius: 4, backgroundColor: colors.surface },
});
