import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useColors, useIsDark } from '../components/theme';
import { Button } from '../components/ui/Button';
import { useStrings } from '../lib/i18n';
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
  const colors = useColors();
  const dark = useIsDark();
  const s = useStrings();
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.text,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  // The native window behind the screens shows during transitions and keyboard animations.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <ShareIntentProvider>
      <SettingsProvider>
        <ShareHandler />
        <StatusBar style="auto" />
        <ThemeProvider value={theme}>
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
            <Stack.Screen name="index" options={{ title: s.nav.channels }} />
            <Stack.Screen name="open" options={{ title: '' }} />
            <Stack.Screen
              name="settings"
              options={{
                title: s.nav.settings,
                presentation: 'modal',
                headerRight:
                  Platform.OS === 'ios' ? () => <Button small variant="ghost" label={s.nav.done} onPress={closeModal} /> : undefined,
              }}
            />
            <Stack.Screen name="channel/[id]" options={{ title: '' }} />
            <Stack.Screen name="video/[id]" options={{ title: '' }} />
            <Stack.Screen name="downloads" options={{ title: s.nav.downloads }} />
          </Stack>
        </ThemeProvider>
      </SettingsProvider>
    </ShareIntentProvider>
  );
}
