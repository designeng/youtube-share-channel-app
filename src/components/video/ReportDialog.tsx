/** "Report" on an AI review: pick what is wrong, optionally explain, send – all without leaving the app. */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, Text, View } from 'react-native';
import { useStrings } from '../../lib/i18n';
import { REPORT_REASONS, reportsGoToDeveloper, sendReport, type ReportReason } from '../../lib/report';
import { useSettings } from '../../lib/settings';
import { radius, space, themed, useType } from '../theme';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';

type Props = { videoId: string; target: string; text: string; onClose: () => void };

export function ReportDialog({ videoId, target, text, onClose }: Props) {
  const { settings } = useSettings();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
  const [reason, setReason] = useState<ReportReason>();
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    if (!reason) return;
    setState('sending');
    try {
      const result = await sendReport({
        reason,
        comment: comment.trim(),
        videoId,
        target,
        text,
        provider: settings.provider,
        model: settings.provider === 'gemini' ? settings.geminiModel : settings.openrouterModel,
        language: settings.outputLanguage,
      });
      if (result === 'sent') setState('sent');
      else if (result === 'shared') onClose();
      else setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View testID="report-dialog" style={styles.card}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text role="heading" style={type.title}>
              {s.report.title}
            </Text>
            {state === 'sent' ? (
              <>
                <Text style={type.body}>{s.report.sent}</Text>
                <Button label={s.common.close} onPress={onClose} />
              </>
            ) : (
              <>
                <View style={styles.reasons}>
                  {REPORT_REASONS.map((r) => (
                    <Chip key={r} label={s.report.reasons[r]} active={reason === r} onPress={() => setReason(r)} />
                  ))}
                </View>
                <Input aria-label={s.report.comment} placeholder={s.report.comment} value={comment} onChangeText={setComment} />
                <Text style={type.micro}>{reportsGoToDeveloper ? s.report.willSend : s.report.willShare}</Text>
                {state === 'failed' && <Banner tone="error" text={s.report.failed} />}
                <View style={styles.actions}>
                  <Button variant="ghost" label={s.common.cancel} onPress={onClose} />
                  <Button
                    testID="report-send"
                    label={s.report.send}
                    onPress={send}
                    disabled={!reason}
                    loading={state === 'sending'}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = themed((colors) => ({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.lg, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { width: '100%', maxWidth: 480, maxHeight: '100%', alignSelf: 'center', borderRadius: radius.lg, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
}));
