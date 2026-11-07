import { router, Stack } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '../components/theme';
import { SettingsProvider } from '../lib/settings';

/** Receives text/URLs from the system Share sheet and opens the channel resolver. */
function ShareHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!hasShareIntent) return;
    const input = shareIntent.webUrl ?? shareIntent.text ?? '';
    resetShareIntent();
    if (input) router.push({ pathname: '/open', params: { input } });
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <SettingsProvider>
        <ShareHandler />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Каналы' }} />
          <Stack.Screen name="open" options={{ title: 'Открываю…' }} />
          <Stack.Screen name="settings" options={{ title: 'Настройки', presentation: 'modal' }} />
          <Stack.Screen name="channel/[id]" options={{ title: '' }} />
          <Stack.Screen name="video/[id]" options={{ title: '' }} />
        </Stack>
      </SettingsProvider>
    </ShareIntentProvider>
  );
}
