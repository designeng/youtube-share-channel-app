/** One row under the player: download the video, follow the progress, manage the saved copy. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { formatBytes } from '../../lib/format';
import { cancelDownload, retryTranscripts, startDownload, useActiveDownloads, type ActiveDownload } from '../../lib/offline/manager';
import type { DownloadRecord } from '../../lib/offline/types';
import { useSettings } from '../../lib/settings';
import type { VideoDetails } from '../../lib/types';
import { colors, space, type } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ProgressBar } from '../ui/ProgressBar';

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
  const failed = active?.phase === 'error';

  const start = () =>
    startDownload(video, {
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

  return (
    <View testID="download-bar" style={styles.bar}>
      {record ? (
        <>
          <View style={styles.row}>
            <Icon name="done" size={18} color={colors.success} />
            <Text style={[type.caption, styles.text]}>
              Скачано · {formatBytes(record.bytes)}
              {record.quality ? ` · ${record.quality}` : ''}
              {playingFile ? ' · из файла' : ''}
            </Text>
            {!playingFile && (
              <Button small variant="secondary" testID="download-play" icon="play" label="Из файла" onPress={onPlayFile} />
            )}
            <IconButton testID="download-delete" icon="trash" size={20} color={colors.muted} label="Удалить скачанное" onPress={askDelete} />
          </View>
          {record.missingLangs.length > 0 && (
            <View style={styles.row}>
              <Icon name="alert" size={18} color={colors.warnText} />
              <Text style={[type.caption, styles.text]}>Нет субтитров: {record.missingLangs.join(', ')}</Text>
              <Button
                small
                variant="ghost"
                testID="download-retry"
                label={retrying ? 'Загружаю…' : 'Дозагрузить'}
                onPress={retry}
                disabled={retrying}
              />
            </View>
          )}
        </>
      ) : active ? (
        <View style={styles.row}>
          <Icon name={failed ? 'alert' : 'download'} size={18} color={failed ? colors.danger : colors.muted} />
          <Text style={[type.caption, styles.text, failed && { color: colors.danger }]}>{downloadStatus(active)}</Text>
          {failed && <Button small variant="secondary" testID="download-start" label="Повторить" onPress={start} />}
          <Button
            small
            variant="ghost"
            testID="download-cancel"
            label={failed ? 'Закрыть' : 'Отмена'}
            onPress={() => cancelDownload(video.id)}
          />
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={[type.caption, styles.text]}>Смотреть без интернета</Text>
          <Button small variant="secondary" testID="download-start" icon="download" label="Скачать" onPress={start} />
        </View>
      )}
      {active?.progress != null && <ProgressBar value={active.progress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  text: { flex: 1 },
});
