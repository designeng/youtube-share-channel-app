import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatDate, formatTime } from '../../lib/format';
import type { VideoDetails } from '../../lib/types';
import { InlineText } from '../Markdown';
import { colors } from '../theme';
import { shared } from './styles';

export function AboutPanel({ video, onSeek }: { video: VideoDetails; onSeek: (sec: number) => void }) {
  return (
    <ScrollView testID="panel-about" contentContainerStyle={shared.body}>
      <Text style={styles.title}>{video.title}</Text>
      <Text style={shared.hint}>
        {video.channelTitle} · {formatDate(video.publishedAt)}
        {video.viewCount != null ? ` · ${formatCount(video.viewCount)} просм.` : ''}
        {video.likeCount != null ? ` · 👍 ${formatCount(video.likeCount)}` : ''}
        {video.durationSec ? ` · ${formatTime(video.durationSec)}` : ''}
      </Text>
      {!!video.description && (
        <View style={shared.card}>
          <Text style={styles.desc}>
            <InlineText text={video.description} onTime={onSeek} />
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  desc: { fontSize: 14, lineHeight: 20, color: colors.text },
});
