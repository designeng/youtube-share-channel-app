/** Design tokens. Screens and components take colors, spacing, radii and text styles from here. */
import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#ffffff',
  surface: '#f4f4f6',
  surfacePressed: '#e9e9ed',
  border: '#e4e4e8',
  text: '#131316',
  muted: '#5d616a',
  /** placeholders and decorative icons only: too light for body text */
  faint: '#8b8f98',
  primary: '#18181c',
  onPrimary: '#ffffff',
  /** the current moment of playback */
  accent: '#d62d20',
  accentSoft: '#fdeeec',
  danger: '#bd2318',
  /** timecodes and links */
  link: '#165bc9',
  linkSoft: '#e9f1fd',
  success: '#18723f',
  warnBg: '#fff3df',
  warnText: '#774100',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/** Minimum comfortable touch target. */
export const TOUCH = 44;

/** Keeps lines readable on tablets and in landscape. */
export const MAX_WIDTH = 720;

export const type = StyleSheet.create({
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.muted },
  micro: { fontSize: 12, lineHeight: 16, color: colors.muted },
});
