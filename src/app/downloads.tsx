import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../components/theme';
import { downloadStatus } from '../components/video/DownloadBar';
import { shared } from '../components/video/styles';
import { confirm } from '../lib/confirm';
import { formatBytes, formatTime } from '../lib/format';
import {
  cancelDownload,
  deleteAllDownloads,
  deleteDownload,
  useActiveDownloads,
  useDownloadList,
} from '../lib/offline/manager';
import { freeSpace, thumbnailUri } from '../lib/offline/store';
import { transcriptLangOf } from '../lib/offline/transcripts';
import type { DownloadRecord } from '../lib/offline/types';

const openVideo = (id: string, title: string) => router.push({ pathname: '/video/[id]', params: { id, title } });

export default function DownloadsScreen() {
  const records = useDownloadList();
  const active = Object.values(useActiveDownloads());
  const insets = useSafeAreaInsets();
  const total = records.reduce((sum, r) => sum + r.bytes, 0);
  const free = freeSpace();

  const askDelete = async (r: DownloadRecord) => {
    const ok = await confirm({ title: 'Удалить скачанное?', message: r.video.title, confirmLabel: 'Удалить', destructive: true });
    if (ok) deleteDownload(r.video.id);
  };

  const askDeleteAll = async () => {
    const ok = await confirm({
      title: 'Удалить все скачанные?',
      message: `Видео: ${records.length}, освободится ${formatBytes(total)}.`,
      confirmLabel: 'Удалить все',
      destructive: true,
    });
    if (ok) deleteAllDownloads();
  };

  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.video.id}
      contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
      ListHeaderComponent={
        <View>
          <View style={styles.summary}>
            <Text testID="downloads-summary" style={[shared.hint, { flex: 1 }]}>
              {records.length ? `Видео: ${records.length} · ${formatBytes(total)}` : 'Пока ничего не скачано.'}
              {free < Number.MAX_SAFE_INTEGER ? ` · свободно ${formatBytes(free)}` : ''}
            </Text>
            {records.length > 0 && (
              <Pressable testID="delete-all" role="button" onPress={askDeleteAll} hitSlop={8}>
                <Text style={styles.danger}>Удалить все</Text>
              </Pressable>
            )}
          </View>
          {active.map((d) => (
            <View key={d.videoId} style={styles.row}>
              <Pressable style={styles.meta} onPress={() => openVideo(d.videoId, d.title)}>
                <Text style={styles.title} numberOfLines={2}>
                  {d.title}
                </Text>
                <Text style={d.phase === 'error' ? shared.error : shared.hint}>{downloadStatus(d)}</Text>
              </Pressable>
              <Pressable role="button" onPress={() => cancelDownload(d.videoId)} hitSlop={8}>
                <Text style={styles.danger}>{d.phase === 'error' ? 'Закрыть' : 'Отмена'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      }
      renderItem={({ item: r }) => (
        <View testID={`download-${r.video.id}`} style={styles.row}>
          <Pressable
            style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}
            onPress={() => openVideo(r.video.id, r.video.title)}
          >
            <Image source={thumbnailUri(r)} style={styles.thumb} contentFit="cover" />
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={2}>
                {r.video.title}
              </Text>
              <Text style={shared.hint} numberOfLines={1}>
                {r.video.channelTitle}
              </Text>
              <Text style={shared.hint}>
                {[
                  r.video.durationSec ? formatTime(r.video.durationSec) : '',
                  formatBytes(r.bytes),
                  r.transcripts.length
                    ? `субтитры: ${[...new Set(r.transcripts.map(transcriptLangOf))].join(', ')}`
                    : 'без субтитров',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </Pressable>
          <Pressable aria-label="Удалить" role="button" onPress={() => askDelete(r)} hitSlop={8}>
            <Text style={styles.danger}>Удалить</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  main: { flex: 1, flexDirection: 'row', gap: 10 },
  thumb: { width: 112, aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: colors.border },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  danger: { color: colors.accent, fontWeight: '600', fontSize: 13 },
});
