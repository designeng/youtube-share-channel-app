import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { radius, space, themed, TOUCH, useColors, useType } from '../components/theme';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { useScreenInsets } from '../components/ui/layout';
import { confirm } from '../lib/confirm';
import { useStrings } from '../lib/i18n';
import { parseChannelRef } from '../lib/parseUrl';
import { getRecentChannels, removeRecentChannel, useSettings, type RecentChannel } from '../lib/settings';
import { IS_PLAY } from '../lib/variant';

export default function Home() {
  const { settings, loaded } = useSettings();
  const insets = useScreenInsets();
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
  /** undefined until read from storage, so the first-run help does not flash */
  const [recent, setRecent] = useState<RecentChannel[]>();
  const [input, setInput] = useState('');
  /** which message to show, so it follows a language change */
  const [inputError, setInputError] = useState<'notALink' | 'emptyClipboard'>();
  const [onlyVideo, setOnlyVideo] = useState(false);
  const isVideo = parseChannelRef(input)?.kind === 'video';

  useFocusEffect(
    useCallback(() => {
      getRecentChannels().then(setRecent);
    }, []),
  );

  const changeInput = (text: string) => {
    setInput(text);
    setInputError(undefined);
  };

  const open = (text: string, video = onlyVideo) => {
    if (!text.trim()) return;
    const ref = parseChannelRef(text);
    // Say what is wrong right here instead of opening a screen only to fail.
    if (!ref) return setInputError('notALink');
    router.push({
      pathname: '/open',
      params: { input: text.trim(), ...(ref.kind === 'video' ? { mode: video ? 'video' : 'channel' } : {}) },
    });
  };

  const paste = async () => {
    const t = await Clipboard.getStringAsync();
    if (!t.trim()) return setInputError('emptyClipboard');
    changeInput(t);
    if (parseChannelRef(t)?.kind !== 'video') open(t);
  };

  const askRemove = async (c: RecentChannel) => {
    const ok = await confirm({ title: s.home.removeTitle, message: c.title, confirmLabel: s.home.remove, destructive: true });
    if (!ok) return;
    await removeRecentChannel(c.id);
    setRecent(await getRecentChannels());
  };

  const header = (
    <View style={styles.top}>
      {loaded && !settings.youtubeKey && (
        <Banner
          tone="warn"
          text={s.home.needKey}
          actionLabel={s.home.setInSettings}
          onAction={() => router.push('/settings')}
        />
      )}
      <Input
        icon="link"
        value={input}
        onChangeText={changeInput}
        onClear={() => changeInput('')}
        invalid={!!inputError}
        placeholder="youtube.com/@handle"
        aria-label={s.home.linkLabel}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={() => open(input)}
      />
      {inputError && (
        <Text role="alert" style={[type.caption, styles.error]}>
          {s.home[inputError]}
        </Text>
      )}
      {isVideo && (
        <Pressable
          role="checkbox"
          aria-checked={onlyVideo}
          style={({ pressed }) => [styles.check, pressed && styles.pressed]}
          onPress={() => setOnlyVideo((v) => !v)}
        >
          <Icon name={onlyVideo ? 'checkboxOn' : 'checkboxOff'} size={24} color={onlyVideo ? colors.primary : colors.muted} />
          <View style={styles.fill}>
            <Text style={type.label}>{s.home.onlyVideo}</Text>
            <Text style={type.micro}>{s.home.onlyVideoHint}</Text>
          </View>
        </Pressable>
      )}
      {input ? (
        <Button label={s.home.open} onPress={() => open(input)} />
      ) : (
        <Button label={s.home.paste} icon="paste" onPress={paste} />
      )}
      {!!recent?.length && (
        <Text role="heading" style={[type.heading, styles.section]}>
          {s.home.recent}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.fill}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              {!IS_PLAY && (
                <IconButton testID="open-downloads" icon="download" label={s.nav.downloads} onPress={() => router.push('/downloads')} />
              )}
              <IconButton icon="settings" label={s.nav.settings} onPress={() => router.push('/settings')} />
            </View>
          ),
        }}
      />
      <FlatList
        data={recent}
        keyExtractor={(c) => c.id}
        contentContainerStyle={insets}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={
          recent ? (
            <View style={styles.help}>
              <Text role="heading" style={type.heading}>
                {s.home.howTo}
              </Text>
              {s.home.steps.map((step, i) => (
                <View key={step} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={type.label}>{i + 1}</Text>
                  </View>
                  <Text style={[type.body, styles.fill]}>{step}</Text>
                </View>
              ))}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={styles.channel}>
            <Pressable
              role="button"
              style={({ pressed }) => [styles.channelMain, pressed && styles.rowPressed]}
              onPress={() => router.push({ pathname: '/channel/[id]', params: { id: item.id, title: item.title } })}
              onLongPress={() => askRemove(item)}
            >
              <Image source={item.thumbnail} style={styles.avatar} />
              <View style={styles.fill}>
                <Text style={type.heading} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.handle ? (
                  <Text style={type.caption} numberOfLines={1}>
                    {item.handle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <IconButton
              icon="close"
              size={18}
              color={colors.muted}
              label={s.home.removeRecent(item.title)}
              onPress={() => askRemove(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

const useStyles = themed((colors) => ({
  fill: { flex: 1 },
  headerButtons: { flexDirection: 'row', gap: space.xs },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
  error: { color: colors.danger },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  pressed: { opacity: 0.6 },
  section: { marginTop: space.md },
  channel: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  channelMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: colors.surface },
  avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface },
  help: { margin: space.lg, marginTop: space.xl, padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  step: { flexDirection: 'row', gap: space.md },
  stepNumber: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
}));
