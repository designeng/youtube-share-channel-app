import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../components/theme';
import { listGeminiModels, listOpenRouterFreeModels, type AiProvider, type ModelOption } from '../lib/ai';
import { useSettings, type Settings } from '../lib/settings';

function Field({
  label,
  value,
  onChange,
  secure,
  placeholder,
  help,
  link,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  placeholder?: string;
  help?: string;
  link?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {help && (
        <Text style={styles.help} onPress={link ? () => Linking.openURL(link) : undefined}>
          {help}
          {link ? <Text style={styles.link}> {link.replace(/^https:\/\//, '')}</Text> : null}
        </Text>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const [models, setModels] = useState<ModelOption[]>();
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string>();

  const draft = settings;
  const set = (patch: Partial<Settings>) => update(patch);

  const pickModel = async () => {
    setModelsError(undefined);
    setModelsLoading(true);
    try {
      setModels(
        draft.provider === 'gemini' ? await listGeminiModels(draft.geminiKey) : await listOpenRouterFreeModels(),
      );
    } catch (e: any) {
      setModelsError(e.message);
    } finally {
      setModelsLoading(false);
    }
  };

  const modelKey = draft.provider === 'gemini' ? 'geminiModel' : 'openrouterModel';

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.section}>YouTube</Text>
      <Field
        label="YouTube Data API v3 key"
        value={draft.youtubeKey}
        onChange={(youtubeKey) => set({ youtubeKey })}
        secure
        placeholder="AIza…"
        help="Бесплатно, 10 000 единиц квоты в день (≈ 5 000 страниц по 50 видео). Google Cloud Console → APIs → YouTube Data API v3 → Credentials:"
        link="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
      />
      <Field
        label="Язык субтитров"
        value={draft.transcriptLang}
        onChange={(transcriptLang) => set({ transcriptLang: transcriptLang.trim() || 'ru' })}
        placeholder="ru"
        help="Код языка (ru, en, de…). Если такой дорожки нет — используется автоперевод YouTube."
      />

      <Text style={styles.section}>AI-обзоры</Text>
      <View style={styles.segment}>
        {(['gemini', 'openrouter'] as AiProvider[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.segItem, draft.provider === p && styles.segActive]}
            onPress={() => set({ provider: p })}
          >
            <Text style={[styles.segText, draft.provider === p && { color: '#fff' }]}>
              {p === 'gemini' ? 'Google Gemini' : 'OpenRouter'}
            </Text>
          </Pressable>
        ))}
      </View>

      {draft.provider === 'gemini' ? (
        <Field
          label="Gemini API key"
          value={draft.geminiKey}
          onChange={(geminiKey) => set({ geminiKey })}
          secure
          placeholder="AIza…"
          help="Бесплатный тариф Google AI Studio. Умеет анализировать само видео, если субтитров нет. Ключ:"
          link="https://aistudio.google.com/apikey"
        />
      ) : (
        <Field
          label="OpenRouter API key"
          value={draft.openrouterKey}
          onChange={(openrouterKey) => set({ openrouterKey })}
          secure
          placeholder="sk-or-…"
          help="Бесплатные модели (суффикс :free) имеют дневной лимит запросов. Ключ:"
          link="https://openrouter.ai/keys"
        />
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Модель</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={draft[modelKey]}
            onChangeText={(v) => set({ [modelKey]: v.trim() } as Partial<Settings>)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.btn} onPress={pickModel}>
            {modelsLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Выбрать</Text>}
          </Pressable>
        </View>
        <Text style={styles.help}>
          {draft.provider === 'gemini'
            ? '«Выбрать» загрузит список моделей, доступных вашему ключу.'
            : '«Выбрать» загрузит актуальный список бесплатных моделей. openrouter/free — автоматический выбор бесплатной модели.'}
        </Text>
        {modelsError && <Text style={styles.error}>{modelsError}</Text>}
      </View>

      <Field
        label="Язык обзоров"
        value={draft.outputLanguage}
        onChange={(outputLanguage) => set({ outputLanguage })}
        placeholder="русский"
        help="AI пишет обзор на этом языке независимо от языка видео."
      />

      <Modal visible={!!models} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModels(undefined)}>
        <View style={{ flex: 1 }}>
          <View style={styles.modalHead}>
            <Text style={styles.section}>Модели ({models?.length ?? 0})</Text>
            <Pressable onPress={() => setModels(undefined)} hitSlop={10}>
              <Text style={styles.link}>Закрыть</Text>
            </Pressable>
          </View>
          <FlatList
            data={models}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.modelRow, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  set({ [modelKey]: item.id } as Partial<Settings>);
                  setModels(undefined);
                }}
              >
                <Text style={[styles.modelId, item.id === draft[modelKey] && { color: colors.accent }]}>{item.id}</Text>
                <Text style={styles.help}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  field: { gap: 6 },
  label: { fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  link: { color: colors.link, fontWeight: '600' },
  error: { color: colors.accent, fontSize: 13 },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  segActive: { backgroundColor: colors.chipActive },
  segText: { fontWeight: '600', color: colors.text },
  btn: { backgroundColor: colors.chipActive, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center', minWidth: 88, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  modelRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modelId: { fontWeight: '600', color: colors.text },
});
