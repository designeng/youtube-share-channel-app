/** One row under the player: download the video, follow the progress, manage the saved copy. */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { formatBytes } from '../../lib/format';
import { cancelDownload, retryTranscripts, startDownload, useActiveDownloads, type ActiveDownload } from '../../lib/offline/manager';
import type { DownloadRecord } from '../../lib/offline/types';
import { useSettings } from '../../lib/settings';
import type { VideoDetails } from '../../lib/types';
import { colors } from '../theme';
import { shared } from './styles';

export function downloadStatus({ phase, progress, error }: ActiveDownload) {
  if (phase === 'error') return error;
  if (phase === 'preparing') return 'Готовлю загрузку…';
  if (phase === 'transcripts') return 'Сохраняю субтитры…';
  return progress == null ? 'Скачиваю…' : `Скачиваю… ${Math.round(progress * 100)}%`;
}

type Props = {
  video: VideoDetails;
  record?: DownloadRecord;
  /** false while the YouTube player is on although a file is already saved */
  playingFile: boolean;
  onPlayFile: () => void;
  onDelete: () => void;
};

export function DownloadBar({ video, record, playingFile, onPlayFile, onDelete }: Props) {
  const { settings } = useSettings();
  const active = useActiveDownloads()[video.id];
  const [retrying, setRetrying] = useState(false);

  const start = () => startDownload(video, {
      wifiOnly: settings.wifiOnly,
      langs: settings.offlineLangs,
      reviewTtlMin: settings.cacheTtlMin,
    });

  const askDelete = async () => {
    const ok = await confirm({ title: 'Удалить скачанное?', message: video.title, confirmLabel: 'Удалить', destructive: true });
    if (ok) onDelete();
  };

  const retry = async () => {
    setRetrying(true);
    await retryTranscripts(video.id);
    setRetrying(false);
  };

  const action = (testID: string, label: string, onPress: () => void, disabled?: boolean) => (
    <Pressable testID={testID} role="button" onPress={onPress} disabled={disabled} hitSlop={8}>
      <Text style={shared.link}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="download-bar" style={styles.bar}>
      {record ? (
        <>
          <View style={styles.row}>
            <Text style={styles.text}>
              ✓ Скачано · {formatBytes(record.bytes)}
              {record.quality ? ` · ${record.quality}` : ''}
              {playingFile ? ' · из файла' : ''}
            </Text>
            {!playingFile && action('download-play', 'Смотреть из файла', onPlayFile)}
            {action('download-delete', 'Удалить', askDelete)}
          </View>
          {record.missingLangs.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.text}>Нет субтитров: {record.missingLangs.join(', ')}</Text>
              {action('download-retry', retrying ? 'Загружаю…' : 'Дозагрузить', retry, retrying)}
            </View>
          )}
        </>
      ) : active ? (
        <View style={styles.row}>
          <Text style={[styles.text, active.phase === 'error' && { color: colors.accent }]}>{downloadStatus(active)}</Text>
          {active.phase === 'error' && action('download-start', 'Повторить', start)}
          {action('download-cancel', active.phase === 'error' ? 'Закрыть' : 'Отмена', () => cancelDownload(video.id))}
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.text}>Смотреть без интернета</Text>
          {action('download-start', '⬇︎ Скачать', start)}
        </View>
      )}
      {active?.progress != null && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${active.progress * 100}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  text: { flex: 1, fontSize: 13, color: colors.muted },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.accent },
});
