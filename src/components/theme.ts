/** Design tokens. Screens and components take colors, spacing, radii and text styles from here. */
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

const light = {
  bg: '#ffffff',
  surface: '#f4f4f6',
  surfacePressed: '#e9e9ed',
  /** the selected segment, lifted above a surface track */
  raised: '#ffffff',
  border: '#e4e4e8',
  text: '#131316',
  muted: '#5d616a',
  /** placeholders and decorative icons only: too light for body text */
  faint: '#8b8f98',
  primary: '#18181c',
  onPrimary: '#ffffff',
  /** track of a switch that is on; the thumb is white in both themes */
  switchOn: '#18181c',
  /** the current moment of playback */
  accent: '#d62d20',
  accentSoft: '#fdeeec',
  danger: '#bd2318',
  /** timecodes and links */
  link: '#165bc9',
  success: '#18723f',
  warnBg: '#fff3df',
  warnText: '#774100',
};

export type Colors = typeof light;

const dark: Colors = {
  bg: '#101013',
  surface: '#1c1c21',
  surfacePressed: '#2a2a31',
  raised: '#37373f',
  border: '#33333b',
  text: '#ececf0',
  muted: '#a4a8b2',
  faint: '#7b7f89',
  primary: '#ececf0',
  onPrimary: '#16161a',
  switchOn: '#3b78e0',
  accent: '#ff5a4d',
  accentSoft: '#35191a',
  danger: '#ff7b6e',
  link: '#7aaeff',
  success: '#58c583',
  warnBg: '#33260d',
  warnText: '#f2c069',
};

/** The app follows the system appearance. */
export const useIsDark = () => useColorScheme() === 'dark';

export const useColors = (): Colors => (useIsDark() ? dark : light);

/** Styles that depend on colors: built once per palette, picked by the system appearance. */
export function themed<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(make: (colors: Colors) => T) {
  const sheets = { light: StyleSheet.create(make(light)), dark: StyleSheet.create(make(dark)) };
  return function useThemedStyles() {
    return sheets[useIsDark() ? 'dark' : 'light'];
  };
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

/** Minimum comfortable touch target. */
export const TOUCH = 44;

/** Keeps lines readable on tablets and in landscape. */
export const MAX_WIDTH = 720;

export const useType = themed((colors) => ({
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.muted },
  micro: { fontSize: 12, lineHeight: 16, color: colors.muted },
}));
