import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { radius, space, themed, useColors, useType } from '../components/theme';
import { Thumbnail } from '../components/Thumbnail';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { useScreenInsets } from '../components/ui/layout';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StateView } from '../components/ui/StateView';
import { downloadStatus } from '../components/video/DownloadBar';
import { confirm } from '../lib/confirm';
import { formatBytes } from '../lib/format';
import { useStrings } from '../lib/i18n';
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
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
  const records = useDownloadList();
  const active = Object.values(useActiveDownloads());
  const insets = useScreenInsets();
  const total = records.reduce((sum, r) => sum + r.bytes, 0);
  const free = freeSpace();
  const freeText = free < Number.MAX_SAFE_INTEGER ? s.downloads.free(formatBytes(free)) : '';

  const askDelete = async (r: DownloadRecord) => {
    const ok = await confirm({
      title: s.downloads.deleteTitle,
      message: r.video.title,
      confirmLabel: s.common.delete,
      destructive: true,
    });
    if (ok) deleteDownload(r.video.id);
  };

  const askDeleteAll = async () => {
    const ok = await confirm({
      title: s.downloads.deleteAllTitle,
      message: s.downloads.deleteAllMessage(records.length, formatBytes(total)),
      confirmLabel: s.downloads.deleteAll,
      destructive: true,
    });
    if (ok) deleteAllDownloads();
  };

  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.video.id}
      contentContainerStyle={insets}
      ListHeaderComponent={
        <View>
          {records.length > 0 && (
            <View style={styles.summary}>
              <Text testID="downloads-summary" style={[type.caption, styles.fill]}>
                {[s.downloads.count(records.length), formatBytes(total), freeText].filter(Boolean).join(' · ')}
              </Text>
              <Button small variant="danger" testID="delete-all" label={s.downloads.deleteAll} onPress={askDeleteAll} />
            </View>
          )}
          {active.map((d) => (
            <View key={d.videoId} style={styles.active}>
              <View style={styles.activeRow}>
                <Pressable role="button" style={styles.meta} onPress={() => openVideo(d.videoId, d.title)}>
                  <Text style={type.label} numberOfLines={2}>
                    {d.title}
                  </Text>
                  <Text style={[type.caption, d.phase === 'error' && { color: colors.danger }]}>{downloadStatus(d)}</Text>
                </Pressable>
                <Button
                  small
                  variant="ghost"
                  label={d.phase === 'error' ? s.common.close : s.common.cancel}
                  onPress={() => cancelDownload(d.videoId)}
                />
              </View>
              {d.progress != null && <ProgressBar value={d.progress} />}
            </View>
          ))}
        </View>
      }
      ListEmptyComponent={
        active.length ? undefined : (
          <StateView
            testID="downloads-summary"
            icon="download"
            title={s.downloads.emptyTitle}
            message={[
              s.downloads.emptyMessage,
              freeText && s.downloads.freeNow(freeText),
            ]
              .filter(Boolean)
              .join('\n')}
          >
            <Button variant="secondary" label={s.downloads.toChannels} onPress={() => router.dismissTo('/')} />
          </StateView>
        )
      }
      renderItem={({ item: r }) => (
        <View testID={`download-${r.video.id}`} style={styles.row}>
          <Pressable
            role="button"
            style={({ pressed }) => [styles.main, pressed && styles.pressed]}
            onPress={() => openVideo(r.video.id, r.video.title)}
          >
            <Thumbnail source={thumbnailUri(r)} durationSec={r.video.durationSec} />
            <View style={styles.meta}>
              <Text style={type.label} numberOfLines={2}>
                {r.video.title}
              </Text>
              <Text style={type.micro} numberOfLines={1}>
                {r.video.channelTitle}
              </Text>
              <Text style={type.micro}>
                {[
                  formatBytes(r.bytes),
                  r.transcripts.length
                    ? s.downloads.subtitles([...new Set(r.transcripts.map(transcriptLangOf))].join(', '))
                    : s.downloads.noSubtitles,
                ].join(' · ')}
              </Text>
            </View>
          </Pressable>
          <IconButton icon="trash" size={20} color={colors.muted} label={s.common.delete} onPress={() => askDelete(r)} />
        </View>
      )}
    />
  );
}

const useStyles = themed((colors) => ({
  fill: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  active: {
    marginHorizontal: space.lg,
    marginVertical: space.xs,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  main: { flex: 1, flexDirection: 'row', gap: space.md, paddingLeft: space.lg, paddingRight: space.xs, paddingVertical: space.sm },
  pressed: { backgroundColor: colors.surface },
  meta: { flex: 1, gap: 3 },
}));
