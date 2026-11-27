import { StyleSheet } from 'react-native';
import { colors } from '../theme';

/** Styles shared by the panels of the video screen. */
export const shared = StyleSheet.create({
  body: { padding: 12, gap: 8, paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 10, padding: 12, gap: 4 },
  hint: { color: colors.muted, fontSize: 13 },
  error: { color: colors.accent, fontSize: 14 },
  link: { color: colors.link, fontWeight: '600' },
  chapter: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8 },
  chapterActive: { backgroundColor: colors.activeBg },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterMain: { flex: 1, flexDirection: 'row', gap: 8 },
  time: { color: colors.link, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 48 },
  chTitle: { flex: 1, color: colors.text, fontSize: 14 },
  aiChip: { borderWidth: 1, borderColor: colors.chipActive, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  aiChipDone: { backgroundColor: colors.chipActive },
  aiChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  aiChipTextDone: { color: '#fff' },
});
