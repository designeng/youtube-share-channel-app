import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../components/theme';
import { parseChannelRef } from '../lib/parseUrl';
import { addRecentChannel, useSettings } from '../lib/settings';
import { resolveChannel } from '../lib/youtubeApi';

/** Resolves any shared YouTube link (channel, handle, video) to a channel and opens it. */
export default function OpenScreen() {
  const { input } = useLocalSearchParams<{ input: string }>();
  const { settings, loaded } = useSettings();
  const ref = useMemo(() => parseChannelRef(String(input ?? '')), [input]);
  const [apiError, setError] = useState<string>();
  const error = ref ? apiError : `Это не похоже на ссылку на YouTube-канал:\n${input}`;

  useEffect(() => {
    if (!loaded || !ref) return;
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
  }, [ref, loaded, settings.youtubeKey]);

  return (
    <View style={styles.c}>
      {error ? (
        <>
          <Text style={styles.err}>{error}</Text>
          {/key|ключ/i.test(error) && (
            <Pressable style={styles.btn} onPress={() => router.push('/settings')}>
              <Text style={styles.btnText}>Открыть настройки</Text>
            </Pressable>
          )}
        </>
      ) : (
        <ActivityIndicator size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  err: { color: colors.accent, textAlign: 'center', fontSize: 15 },
  btn: { backgroundColor: colors.chipActive, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
});
