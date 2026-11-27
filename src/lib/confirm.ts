import { Alert } from 'react-native';
import { t } from './i18n';

export type ConfirmOptions = { title: string; message: string; confirmLabel: string; destructive?: boolean };

export function confirm({ title, message, confirmLabel, destructive }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: t().common.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
