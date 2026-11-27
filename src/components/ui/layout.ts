import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_WIDTH } from '../theme';

/**
 * Content container style for a scrolling screen: clears the home indicator and, in landscape, the notch,
 * and keeps the column centered on wide screens.
 */
export function useScreenInsets(bottom = 24) {
  const insets = useSafeAreaInsets();
  return {
    width: '100%',
    maxWidth: MAX_WIDTH + insets.left + insets.right,
    alignSelf: 'center',
    paddingLeft: insets.left,
    paddingRight: insets.right,
    paddingBottom: insets.bottom + bottom,
  } as const;
}
