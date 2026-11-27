/**
 * Which build this is. The Play build leaves out downloads and everything that relies on YouTube's private
 * endpoints. This flag hides the UI; the code itself is swapped for *.play.ts(x) files by metro.config.js.
 */
export const IS_PLAY = process.env.EXPO_PUBLIC_APP_VARIANT === 'play';
