import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space, TOUCH, type } from '../components/theme';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Icon } from '../components/ui/Icon';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { useScreenInsets } from '../components/ui/layout';
import { Segmented } from '../components/ui/Segmented';
import { StateView } from '../components/ui/StateView';
import { listGeminiModels, listOpenRouterFreeModels, type AiProvider, type ModelOption } from '../lib/ai';
import { OFFLINE_LANGS } from '../lib/offline/types';
import { useSettings, type Settings } from '../lib/settings';

const PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'gemini', label: 'Google Gemini' },
  { key: 'openrouter', label: 'OpenRouter' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text role="heading" style={type.title}>
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

type FieldProps = Omit<TextInputProps, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  help?: string;
  link?: string;
};

function Field({ label, value, onChange, secure, help, link, ...input }: FieldProps) {
  // While editing, show what was typed: the stored value may be normalized (an empty language becomes "ru").
  const [draft, setDraft] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <Input
        {...input}
        aria-label={label}
        value={draft ?? value}
        onChangeText={(v) => {
          setDraft(v);
          onChange(v);
        }}
        onBlur={() => setDraft(undefined)}
        secureTextEntry={secure && !revealed}
        trailing={
          secure && !!value ? (
            <IconButton
              icon={revealed ? 'eyeOff' : 'eye'}
              size={20}
              color={colors.muted}
              label={revealed ? 'Скрыть ключ' : 'Показать ключ'}
              onPress={() => setRevealed((r) => !r)}
            />
          ) : undefined
        }
      />
      {help && <Text style={type.micro}>{help}</Text>}
      {link && (
        <Pressable
          role="link"
          hitSlop={8}
          onPress={() => Linking.openURL(link)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkText} numberOfLines={1}>
            {link.replace(/^https:\/\//, '')}
          </Text>
          <Icon name="external" size={14} color={colors.link} />
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const screenInsets = useScreenInsets(32);
  const headerHeight = useHeaderHeight();
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
  const closeModels = () => setModels(undefined);

  return (
    // Android is edge-to-edge, so the window does not resize for the keyboard; iOS is handled by the ScrollView.
    <KeyboardAvoidingView
      style={styles.fill}
      behavior="padding"
      enabled={Platform.OS === 'android'}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={[styles.body, screenInsets]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[type.caption, styles.saved]}>Изменения сохраняются автоматически.</Text>
        <Section title="YouTube">
          <Field
            label="YouTube Data API v3 key"
            value={draft.youtubeKey}
            onChange={(youtubeKey) => set({ youtubeKey })}
            secure
            placeholder="AIza…"
            help="Бесплатно, 10 000 единиц квоты в день (≈ 5 000 страниц по 50 видео). Google Cloud Console → APIs → YouTube Data API v3 → Credentials."
            link="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
          />
          <Field
            label="Язык субтитров"
            value={draft.transcriptLang}
            onChange={(transcriptLang) => set({ transcriptLang: transcriptLang.trim() || 'ru' })}
            placeholder="ru"
            help="Код языка (ru, en, de…). Если такой дорожки нет — используется автоперевод YouTube."
          />
        </Section>

        <Section title="Скачивание">
          <View style={styles.switchRow}>
            <View style={[styles.fill, styles.switchText]}>
              <Text style={type.label}>Только по Wi-Fi</Text>
              <Text style={type.micro}>
                Без Wi-Fi приложение предупредит о расходе трафика и спросит разрешения. Если Wi-Fi пропадёт во время
                загрузки, она остановится.
              </Text>
            </View>
            <Switch
              testID="wifi-only"
              aria-label="Только по Wi-Fi"
              value={draft.wifiOnly}
              onValueChange={(wifiOnly) => set({ wifiOnly })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? colors.bg : undefined}
              {...(Platform.OS === 'web' ? { activeThumbColor: colors.bg } : undefined)}
            />
          </View>
          <View style={styles.field}>
            <Text style={type.label}>Субтитры для офлайна</Text>
            <View style={styles.chips}>
              {OFFLINE_LANGS.map((l) => {
                const on = draft.offlineLangs.includes(l.code);
                return (
                  <Chip
                    key={l.code}
                    role="checkbox"
                    label={l.label}
                    active={on}
                    onPress={() =>
                      set({
                        offlineLangs: on
                          ? draft.offlineLangs.filter((c) => c !== l.code)
                          : [...draft.offlineLangs, l.code],
                      })
                    }
                  />
                );
              })}
            </View>
            <Text style={type.micro}>Сохраняются вместе с видео, плюс дорожка на языке оригинала.</Text>
          </View>
        </Section>

        <Section title="AI-обзоры">
          <Segmented options={PROVIDERS} value={draft.provider} onChange={(provider) => set({ provider })} />

          {draft.provider === 'gemini' ? (
            <Field
              key="gemini"
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
              key="openrouter"
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
            <Text style={type.label}>Модель</Text>
            <View style={styles.modelPick}>
              <View style={styles.fill}>
                <Input
                  aria-label="Модель"
                  value={draft[modelKey]}
                  onChangeText={(v) => set({ [modelKey]: v.trim() } as Partial<Settings>)}
                />
              </View>
              <Button variant="secondary" label="Выбрать" onPress={pickModel} loading={modelsLoading} />
            </View>
            <Text style={type.micro}>
              {draft.provider === 'gemini'
                ? '«Выбрать» загрузит список моделей, доступных вашему ключу.'
                : '«Выбрать» загрузит актуальный список бесплатных моделей. openrouter/free — автоматический выбор бесплатной модели.'}
            </Text>
            {modelsError && <Banner tone="error" text={modelsError} actionLabel="Повторить" onAction={pickModel} />}
          </View>

          <Field
            label="Язык обзоров"
            value={draft.outputLanguage}
            onChange={(outputLanguage) => set({ outputLanguage })}
            placeholder="русский"
            help="AI пишет обзор на этом языке независимо от языка видео."
          />

          <Field
            label="Кеш AI-обзоров (минут)"
            value={String(draft.cacheTtlMin)}
            onChange={(v) => {
              const n = parseInt(v.replace(/\D/g, ''), 10);
              set({ cacheTtlMin: Number.isFinite(n) ? n : 0 });
            }}
            placeholder="60"
            keyboardType="number-pad"
            help="Сколько хранить готовый обзор фрагмента видео, чтобы не запрашивать AI повторно. По умолчанию 60 (1 час), 0 — не кешировать. «Перегенерировать» всегда обновляет кеш. Обзоры скачанных видео хранятся вместе с файлом и не устаревают."
          />
        </Section>
      </ScrollView>

      <Modal
        visible={!!models}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent
        onRequestClose={closeModels}
      >
        <View style={styles.modal}>
          {/* An iOS page sheet already starts below the status bar. */}
          <View style={[styles.modalHead, { paddingTop: space.sm + (Platform.OS === 'ios' ? 0 : insets.top) }]}>
            <Text role="heading" style={[type.title, styles.fill]}>
              Модели ({models?.length ?? 0})
            </Text>
            <IconButton icon="close" label="Закрыть" onPress={closeModels} />
          </View>
          <FlatList
            data={models}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.md }}
            ListEmptyComponent={<StateView icon="ai" title="Список пуст" message="Не нашлось ни одной подходящей модели." />}
            renderItem={({ item }) => {
              const selected = item.id === draft[modelKey];
              return (
                <Pressable
                  role="button"
                  aria-selected={selected}
                  style={({ pressed }) => [styles.modelRow, pressed && styles.rowPressed]}
                  onPress={() => {
                    set({ [modelKey]: item.id } as Partial<Settings>);
                    closeModels();
                  }}
                >
                  <View style={styles.fill}>
                    <Text style={type.label}>{item.id}</Text>
                    <Text style={type.micro}>{item.label}</Text>
                  </View>
                  {selected && <Icon name="check" color={colors.text} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingTop: space.xs, gap: space.xl },
  saved: { paddingHorizontal: space.lg },
  section: { gap: space.md, paddingHorizontal: space.lg },
  card: { gap: space.xl, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  field: { gap: space.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', maxWidth: '100%' },
  linkText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.link },
  pressed: { opacity: 0.6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
  switchText: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  modelPick: { flexDirection: 'row', gap: space.sm },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: TOUCH + 12,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surface },
});
