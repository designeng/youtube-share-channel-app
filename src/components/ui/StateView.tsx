/** Empty, loading and error states: what happened and what can be done about it. */
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  icon?: IconName;
  tone?: 'neutral' | 'error';
  loading?: boolean;
  title?: string;
  message?: string;
  /** buttons */
  children?: ReactNode;
  testID?: string;
};

export function StateView({ icon, tone = 'neutral', loading, title, message, children, testID }: Props) {
  const error = tone === 'error';
  return (
    <View testID={testID} role={error ? 'alert' : undefined} style={styles.wrap}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.muted} />
      ) : icon ? (
        <View style={[styles.icon, error && styles.iconError]}>
          <Icon name={icon} size={28} color={error ? colors.danger : colors.muted} />
        </View>
      ) : null}
      {title && <Text style={[type.heading, styles.center]}>{title}</Text>}
      {message && <Text style={[type.caption, styles.center]}>{message}</Text>}
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxl, gap: space.sm },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  iconError: { backgroundColor: colors.accentSoft },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', alignItems: 'stretch', gap: space.sm, marginTop: space.md, maxWidth: 360, width: '100%', marginHorizontal: 'auto' },
});
