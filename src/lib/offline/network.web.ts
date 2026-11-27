/** Browsers do not tell Wi-Fi from mobile data; the tests set `window.__network` to simulate it. */
import type { NetworkKind } from './network';

export const getNetworkKind = async (): Promise<NetworkKind> =>
  (window as unknown as { __network?: NetworkKind }).__network ?? (navigator.onLine ? 'wifi' : 'offline');

export function onNetworkChange(listener: (k: NetworkKind) => void): () => void {
  const handler = () => getNetworkKind().then(listener);
  window.addEventListener('e2e-network', handler);
  return () => window.removeEventListener('e2e-network', handler);
}
