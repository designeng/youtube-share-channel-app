/** UI language follows the system: Russian or English, whichever comes first in the user's list. */
import { getLocales, useLocales, type Locale } from 'expo-localization';
import { en, type Strings } from './en';
import { ru } from './ru';

export type Language = 'ru' | 'en';

const STRINGS: Record<Language, Strings> = { ru, en };

const isSupported = (code: string | null): code is Language => code === 'ru' || code === 'en';

function pick(locales: Locale[]) {
  const found = locales.find((l) => isSupported(l.languageCode));
  const language: Language = found && isSupported(found.languageCode) ? found.languageCode : 'en';
  // Keeps the regional date format (en-GB, en-US…) when the system has one for this language.
  return { language, tag: found?.languageTag ?? 'en-US' };
}

export const getLanguage = () => pick(getLocales()).language;

export const getLocaleTag = () => pick(getLocales()).tag;

/** For code outside React: errors, formatting, downloads. */
export const t = () => STRINGS[getLanguage()];

/**
 * For components: re-renders them when the system language changes (Android keeps the app running;
 * iOS restarts it). Call it in every component that shows translated or formatted text.
 */
export const useStrings = () => STRINGS[pick(useLocales()).language];
