import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/**
 * A panel that stays mounted while another one is shown, keeping its scroll position and following
 * playback. It keeps its size too (`display: 'none'` would not), so it can be scrolled while hidden.
 */
export function Layer({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, !active && styles.hidden]}
      aria-hidden={!active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // On the web `visibility` also takes the panel out of keyboard focus.
  hidden: { opacity: 0, pointerEvents: 'none', ...(Platform.OS === 'web' ? ({ visibility: 'hidden' } as object) : null) },
});
