import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button } from '../components/ui/Button';
import { useScreenInsets } from '../components/ui/layout';
import { StateView } from '../components/ui/StateView';
import { errorText } from '../lib/format';
import { parseChannelRef } from '../lib/parseUrl';
import { addRecentChannel, useSettings } from '../lib/settings';
import { resolveChannel } from '../lib/youtubeApi';

/** Resolves any shared YouTube link (channel, handle, video) to a channel and opens it. */
export default function OpenScreen() {
  const { input, mode } = useLocalSearchParams<{ input: string; mode?: 'video' | 'channel' }>();
  const { settings, loaded } = useSettings();
  const insets = useScreenInsets();
  const ref = useMemo(() => parseChannelRef(String(input ?? '')), [input]);
  const [apiError, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<'video' | 'channel' | undefined>(mode);
  const needChoice = ref?.kind === 'video' && !choice;
  const error = ref ? apiError : `Это не похоже на ссылку на YouTube-канал:\n${input}`;

  useEffect(() => {
    if (!loaded || !ref || needChoice) return;
    if (ref.kind === 'video' && choice === 'video') {
      router.replace({ pathname: '/video/[id]', params: { id: ref.value } });
      return;
    }
    let cancelled = false;
    resolveChannel(ref, settings.youtubeKey)
      .then(async (ch) => {
        if (cancelled) return;
        await addRecentChannel(ch);
        router.replace({ pathname: '/channel/[id]', params: { id: ch.id, title: ch.title } });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ref, loaded, settings.youtubeKey, needChoice, choice, attempt]);

  const retry = () => {
    setError(undefined);
    setAttempt((n) => n + 1);
  };

  return (
    <ScrollView contentContainerStyle={[styles.body, insets]}>
      <Stack.Screen options={{ title: '' }} />
      {needChoice ? (
        <StateView icon="video" title="Это ссылка на видео" message="Что открыть?">
          <Button icon="play" label="Открыть только видео" onPress={() => setChoice('video')} />
          <Button variant="secondary" icon="channel" label="Открыть весь канал" onPress={() => setChoice('channel')} />
        </StateView>
      ) : error ? (
        <StateView icon="alert" tone="error" title="Не получилось открыть" message={errorText(error)}>
          {/key|ключ/i.test(error) && (
            <Button icon="settings" label="Открыть настройки" onPress={() => router.push('/settings')} />
          )}
          {ref && <Button variant="secondary" icon="refresh" label="Повторить" onPress={retry} />}
          <Button variant="ghost" label="На главную" onPress={() => router.dismissTo('/')} />
        </StateView>
      ) : (
        <StateView loading message="Ищу канал…" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, justifyContent: 'center' },
});
