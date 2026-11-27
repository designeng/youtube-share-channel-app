/** Platform symbols (SF Symbols on iOS, Material Symbols on Android and web) under app-level names. */
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { colors } from '../theme';

type Names = Exclude<SymbolViewProps['name'], string>;

const ICONS = {
  ai: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  alert: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  chapters: { ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  checkboxOff: { ios: 'square', android: 'check_box_outline_blank', web: 'check_box_outline_blank' },
  checkboxOn: { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' },
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronUp: { ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  done: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  download: { ios: 'arrow.down.circle', android: 'download', web: 'download' },
  external: { ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  follow: { ios: 'scope', android: 'my_location', web: 'my_location' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  link: { ios: 'link', android: 'link', web: 'link' },
  paste: { ios: 'doc.on.clipboard', android: 'content_paste', web: 'content_paste' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  sort: { ios: 'arrow.up.arrow.down', android: 'swap_vert', web: 'swap_vert' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  transcript: { ios: 'text.quote', android: 'subtitles', web: 'subtitles' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  video: { ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' },
  channel: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
} satisfies Record<string, Names>;

export type IconName = keyof typeof ICONS;

/** Decorative: the control around it carries the accessible label. */
export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}
