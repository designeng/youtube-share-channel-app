/** react-native-web has no Alert. */
import type { ConfirmOptions } from './confirm';

export const confirm = async ({ title, message }: ConfirmOptions) => window.confirm(`${title}\n\n${message}`);
