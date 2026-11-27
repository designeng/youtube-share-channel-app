import * as Network from 'expo-network';

/** 'metered' is anything we cannot be sure is Wi-Fi (or a cable): mobile data above all. */
export type NetworkKind = 'wifi' | 'metered' | 'offline';

function kind({ type }: Network.NetworkState): NetworkKind {
  if (type === Network.NetworkStateType.WIFI || type === Network.NetworkStateType.ETHERNET) return 'wifi';
  return type === Network.NetworkStateType.NONE ? 'offline' : 'metered';
}

export const getNetworkKind = async () => kind(await Network.getNetworkStateAsync());

export function onNetworkChange(listener: (k: NetworkKind) => void): () => void {
  const sub = Network.addNetworkStateListener((state) => listener(kind(state)));
  return () => sub.remove();
}
