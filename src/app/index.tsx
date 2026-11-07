import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../components/theme';
import { getRecentChannels, removeRecentChannel, useSettings, type RecentChannel } from '../lib/settings';

export default function Home() {
  const { settings, loaded } = useSettings();
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [input, setInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      getRecentChannels().then(setRecent);
    }, []),
  );

  const open = (text: string) => text.trim() && router.push({ pathname: '/open', params: { input: text.trim() } });
  const paste = async () => {
    const t = await Clipboard.getStringAsync();
    if (t) {
      setInput(t);
      open(t);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
              <Text style={{ fontSize: 22 }}>⚙︎</Text>
            </Pressable>
          ),
        }}
      />
      {loaded && !settings.youtubeKey && (
        <Pressable style={styles.warn} onPress={() => router.push('/settings')}>
          <Text style={styles.warnText}>Укажите YouTube Data API key в настройках, чтобы загружать видео канала →</Text>
        </Pressable>
      )}
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          В приложении YouTube откройте канал → «Поделиться» → выберите это приложение. Или вставьте ссылку:
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="youtube.com/@handle"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => open(input)}
          />
          <Pressable style={styles.btn} onPress={() => (input ? open(input) : paste())}>
            <Text style={styles.btnText}>{input ? 'Открыть' : 'Вставить'}</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={recent}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={recent.length ? <Text style={styles.section}>Недавние</Text> : undefined}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            onPress={() => router.push({ pathname: '/channel/[id]', params: { id: item.id, title: item.title } })}
            onLongPress={async () => {
              await removeRecentChannel(item.id);
              setRecent(await getRecentChannels());
            }}
          >
            <Image source={item.thumbnail} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              {item.handle ? <Text style={styles.sub}>{item.handle}</Text> : null}
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          recent.length ? <Text style={styles.footer}>Долгое нажатие — удалить из списка</Text> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { backgroundColor: '#fff4e5', padding: 12 },
  warnText: { color: '#8a4b00' },
  hint: { padding: 16, gap: 10 },
  hintText: { color: colors.muted, fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  btn: { backgroundColor: colors.chipActive, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, fontWeight: '700', color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, padding: 16 },
});
