/** The notice above a transcript that is not in the wanted language, with translation by AI on demand. */
import { useEffect, useRef, useState } from 'react';
import { translateTranscript } from '../../lib/aiTranslate';
import { errorText } from '../../lib/format';
import { useStrings } from '../../lib/i18n';
import type { Settings } from '../../lib/settings';
import type { Transcript } from '../../lib/types';

export type TranscriptNotice = {
  tone: 'info' | 'warn' | 'error';
  text: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss?: () => void;
};

type Args = {
  videoId: string;
  /** the transcript on the screen, when it is not in the wanted language */
  source?: Transcript;
  /** the wanted language, absent when there is nothing to translate */
  lang?: string;
  settings: Settings;
  onTranslated: (t: Transcript) => void;
};

export function useAiTranslation({ videoId, source, lang, settings, onTranslated }: Args): TranscriptNotice | undefined {
  const s = useStrings();
  const [running, setRunning] = useState<{ lang: string; done: number; total: number; status?: string }>();
  const [failure, setFailure] = useState<{ source: Transcript; message: string }>();
  const [dismissed, setDismissed] = useState<Transcript>();
  const controller = useRef<AbortController>(undefined);

  // Leaving the screen stops spending the quota.
  useEffect(() => () => controller.current?.abort(), [videoId]);

  const stop = () => {
    controller.current?.abort();
    setRunning(undefined);
  };

  const start = async (from: Transcript, to: string) => {
    const own = new AbortController();
    controller.current = own;
    setFailure(undefined);
    setRunning({ lang: to, done: 1, total: 1 });
    try {
      const result = await translateTranscript(videoId, from, to, settings, {
        signal: own.signal,
        onProgress: (done, total) => !own.signal.aborted && setRunning({ lang: to, done, total }),
        onStatus: (status) => !own.signal.aborted && setRunning((r) => r && { ...r, status }),
      });
      if (!own.signal.aborted) onTranslated(result);
    } catch (e: any) {
      if (!own.signal.aborted) setFailure({ source: from, message: e.message });
    }
    if (!own.signal.aborted) setRunning(undefined);
  };

  if (running)
    return {
      tone: 'info',
      text: running.status ?? s.transcript.translating(running.lang, running.done, running.total),
      actionLabel: s.ai.stop,
      onAction: stop,
    };
  if (!source || !lang || dismissed === source) return undefined;
  const failed = failure?.source === source ? failure.message : undefined;
  return {
    tone: failed ? 'error' : 'warn',
    text: failed ? errorText(failed) : source.translationFailed ? s.transcript.translationLimited : s.transcript.noLanguage(lang),
    actionLabel: s.transcript.translateWithAi,
    onAction: () => start(source, lang),
    onDismiss: () => setDismissed(source),
  };
}
