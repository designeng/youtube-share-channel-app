/** One row under the player: download the video, follow the progress, manage the saved copy. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { formatBytes } from '../../lib/format';
import { t, useStrings } from '../../lib/i18n';
import { cancelDownload, retryTranscripts, startDownload, useActiveDownloads, type ActiveDownload } from '../../lib/offline/manager';
import type { DownloadRecord } from '../../lib/offline/types';
import { useSettings } from '../../lib/settings';
import type { VideoDetails } from '../../lib/types';
import { space, themed, useColors, useType } from '../theme';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { ProgressBar } from '../ui/ProgressBar';

export function downloadStatus({ phase, progress, error }: ActiveDownload) {
  if (phase === 'error') return error;
  if (phase === 'preparing') return t().download.preparing;
  if (phase === 'transcripts') return t().download.savingSubtitles;
  return t().download.downloading(progress == null ? undefined : Math.round(progress * 100));
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
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
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
    const ok = await confirm({
      title: s.downloads.deleteTitle,
      message: video.title,
      confirmLabel: s.common.delete,
      destructive: true,
    });
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
              {s.download.downloaded} · {formatBytes(record.bytes)}
              {record.quality ? ` · ${record.quality}` : ''}
              {playingFile ? ` · ${s.download.fromFile}` : ''}
            </Text>
            {!playingFile && (
              <Button small variant="secondary" testID="download-play" icon="play" label={s.download.playFile} onPress={onPlayFile} />
            )}
            <IconButton testID="download-delete" icon="trash" size={20} color={colors.muted} label={s.download.deleteLabel} onPress={askDelete} />
          </View>
          {record.missingLangs.length > 0 && (
            <View style={styles.row}>
              <Icon name="alert" size={18} color={colors.warnText} />
              <Text style={[type.caption, styles.text]}>{s.download.missingSubtitles(record.missingLangs.join(', '))}</Text>
              <Button
                small
                variant="ghost"
                testID="download-retry"
                label={retrying ? s.download.loadingMore : s.download.fetchMissing}
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
          {failed && <Button small variant="secondary" testID="download-start" label={s.common.retry} onPress={start} />}
          <Button
            small
            variant="ghost"
            testID="download-cancel"
            label={failed ? s.common.close : s.common.cancel}
            onPress={() => cancelDownload(video.id)}
          />
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={[type.caption, styles.text]}>{s.download.offer}</Text>
          <Button small variant="secondary" testID="download-start" icon="download" label={s.download.start} onPress={start} />
        </View>
      )}
      {active?.progress != null && <ProgressBar value={active.progress} />}
    </View>
  );
}

const useStyles = themed((colors) => ({
  bar: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 },
  text: { flex: 1 },
}));
