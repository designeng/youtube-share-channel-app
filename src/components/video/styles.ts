import { radius, space, themed } from '../theme';

/** Styles shared by the panels of the video screen. */
export const useShared = themed((colors) => ({
  body: { padding: space.md, gap: space.xs, paddingBottom: space.xl },
  time: { color: colors.link, fontSize: 13, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 46 },
  chips: { gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.sm },
}));
