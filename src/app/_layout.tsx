import { router, Stack } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { colors } from '../components/theme';
import { Button } from '../components/ui/Button';
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

/** An iOS modal has no back arrow, only the swipe gesture. */
const closeModal = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <SettingsProvider>
        <ShareHandler />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.text,
            headerStyle: { backgroundColor: colors.bg },
            headerTitleStyle: { fontSize: 17, fontWeight: '700' },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Каналы' }} />
          <Stack.Screen name="open" options={{ title: '' }} />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Настройки',
              presentation: 'modal',
              headerRight:
                Platform.OS === 'ios' ? () => <Button small variant="ghost" label="Готово" onPress={closeModal} /> : undefined,
            }}
          />
          <Stack.Screen name="channel/[id]" options={{ title: '' }} />
          <Stack.Screen name="video/[id]" options={{ title: '' }} />
          <Stack.Screen name="downloads" options={{ title: 'Скачанные' }} />
        </Stack>
      </SettingsProvider>
    </ShareIntentProvider>
  );
}
