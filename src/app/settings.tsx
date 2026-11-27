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
import { radius, space, themed, TOUCH, useColors, useType } from '../components/theme';
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
import { getLanguage, useStrings } from '../lib/i18n';
import { OFFLINE_LANGS } from '../lib/offline/types';
import { useSettings, type Settings } from '../lib/settings';

const PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'gemini', label: 'Google Gemini' },
  { key: 'openrouter', label: 'OpenRouter' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const type = useType();
  const styles = useStyles();
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
  // While editing, show what was typed: the stored value may be normalized (an empty language gets the system one).
  const [draft, setDraft] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
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
              label={revealed ? s.settings.hideKey : s.settings.showKey}
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
  const colors = useColors();
  const type = useType();
  const styles = useStyles();
  const s = useStrings();
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
        <Text style={[type.caption, styles.saved]}>{s.settings.saved}</Text>
        <Section title="YouTube">
          <Field
            label="YouTube Data API v3 key"
            value={draft.youtubeKey}
            onChange={(youtubeKey) => set({ youtubeKey })}
            secure
            placeholder="AIza…"
            help={s.settings.youtubeHelp}
            link="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
          />
          <Field
            label={s.settings.transcriptLang}
            value={draft.transcriptLang}
            onChange={(transcriptLang) => set({ transcriptLang: transcriptLang.trim() || getLanguage() })}
            placeholder={getLanguage()}
            help={s.settings.transcriptLangHelp}
          />
        </Section>

        <Section title={s.settings.downloading}>
          <View style={styles.switchRow}>
            <View style={[styles.fill, styles.switchText]}>
              <Text style={type.label}>{s.settings.wifiOnly}</Text>
              <Text style={type.micro}>{s.settings.wifiOnlyHelp}</Text>
            </View>
            <Switch
              testID="wifi-only"
              aria-label={s.settings.wifiOnly}
              value={draft.wifiOnly}
              onValueChange={(wifiOnly) => set({ wifiOnly })}
              trackColor={{ false: colors.border, true: colors.switchOn }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
              {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff' } : undefined)}
            />
          </View>
          <View style={styles.field}>
            <Text style={type.label}>{s.settings.offlineSubtitles}</Text>
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
            <Text style={type.micro}>{s.settings.offlineSubtitlesHelp}</Text>
          </View>
        </Section>

        <Section title={s.settings.aiReviews}>
          <Segmented options={PROVIDERS} value={draft.provider} onChange={(provider) => set({ provider })} />

          {draft.provider === 'gemini' ? (
            <Field
              key="gemini"
              label="Gemini API key"
              value={draft.geminiKey}
              onChange={(geminiKey) => set({ geminiKey })}
              secure
              placeholder="AIza…"
              help={s.settings.geminiHelp}
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
              help={s.settings.openrouterHelp}
              link="https://openrouter.ai/keys"
            />
          )}

          <View style={styles.field}>
            <Text style={type.label}>{s.settings.model}</Text>
            <View style={styles.modelPick}>
              <View style={styles.fill}>
                <Input
                  aria-label={s.settings.model}
                  value={draft[modelKey]}
                  onChangeText={(v) => set({ [modelKey]: v.trim() } as Partial<Settings>)}
                />
              </View>
              <Button variant="secondary" label={s.settings.pick} onPress={pickModel} loading={modelsLoading} />
            </View>
            <Text style={type.micro}>
              {draft.provider === 'gemini' ? s.settings.geminiModelHelp : s.settings.openrouterModelHelp}
            </Text>
            {modelsError && <Banner tone="error" text={modelsError} actionLabel={s.common.retry} onAction={pickModel} />}
          </View>

          <Field
            label={s.settings.reviewLang}
            value={draft.outputLanguage}
            onChange={(outputLanguage) => set({ outputLanguage })}
            placeholder={s.settings.reviewLangPlaceholder}
            help={s.settings.reviewLangHelp}
          />

          <Field
            label={s.settings.cacheTtl}
            value={String(draft.cacheTtlMin)}
            onChange={(v) => {
              const n = parseInt(v.replace(/\D/g, ''), 10);
              set({ cacheTtlMin: Number.isFinite(n) ? n : 0 });
            }}
            placeholder="60"
            keyboardType="number-pad"
            help={s.settings.cacheTtlHelp}
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
              {s.settings.models(models?.length ?? 0)}
            </Text>
            <IconButton icon="close" label={s.common.close} onPress={closeModels} />
          </View>
          <FlatList
            data={models}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.md }}
            ListEmptyComponent={<StateView icon="ai" title={s.settings.emptyList} message={s.settings.noModels} />}
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

const useStyles = themed((colors) => ({
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
}));
