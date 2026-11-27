import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatDate, formatTime } from '../../lib/format';
import type { VideoDetails } from '../../lib/types';
import { InlineText } from '../Markdown';
import { space, type } from '../theme';
import { shared } from './styles';

export function AboutPanel({ video, onSeek }: { video: VideoDetails; onSeek: (sec: number) => void }) {
  const stats = [
    { label: 'Опубликовано', value: formatDate(video.publishedAt) },
    video.viewCount != null && { label: 'Просмотры', value: formatCount(video.viewCount) },
    video.likeCount != null && { label: 'Лайки', value: formatCount(video.likeCount) },
    !!video.durationSec && { label: 'Длительность', value: formatTime(video.durationSec) },
  ].filter((s) => !!s);

  return (
    <ScrollView testID="panel-about" contentContainerStyle={[shared.body, styles.body]}>
      <View style={styles.head}>
        <Text style={type.title} selectable>
          {video.title}
        </Text>
        <Text style={type.caption}>{video.channelTitle}</Text>
      </View>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={type.micro}>{s.label}</Text>
            <Text style={type.label}>{s.value}</Text>
          </View>
        ))}
      </View>
      {video.description ? (
        <View style={shared.card}>
          <Text style={type.body} selectable>
            <InlineText text={video.description} onTime={onSeek} />
          </Text>
        </View>
      ) : (
        <Text style={type.caption}>Автор не добавил описание.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  head: { gap: space.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.md },
  stat: { gap: 2 },
});
