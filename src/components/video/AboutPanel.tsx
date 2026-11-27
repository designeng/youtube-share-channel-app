import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatDate, formatTime } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import type { VideoDetails } from '../../lib/types';
import { InlineText } from '../Markdown';
import { space, useType } from '../theme';
import { useShared } from './styles';

export function AboutPanel({ video, onSeek }: { video: VideoDetails; onSeek: (sec: number) => void }) {
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  const stats = [
    { label: s.about.published, value: formatDate(video.publishedAt) },
    video.viewCount != null && { label: s.about.views, value: formatCount(video.viewCount) },
    video.likeCount != null && { label: s.about.likes, value: formatCount(video.likeCount) },
    !!video.durationSec && { label: s.about.duration, value: formatTime(video.durationSec) },
  ].filter((stat) => !!stat);

  return (
    <ScrollView testID="panel-about" contentContainerStyle={[shared.body, styles.body]}>
      <View style={styles.head}>
        <Text style={type.title} selectable>
          {video.title}
        </Text>
        <Text style={type.caption}>{video.channelTitle}</Text>
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={type.micro}>{stat.label}</Text>
            <Text style={type.label}>{stat.value}</Text>
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
        <Text style={type.caption}>{s.about.noDescription}</Text>
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
