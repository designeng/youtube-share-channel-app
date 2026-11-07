import { getShareExtensionKey } from 'expo-share-intent';

/**
 * iOS share extension opens the app through a deep link containing `dataUrl=<key>`.
 * That path is not a route – send it to the home screen; <ShareHandler/> in _layout
 * then reads the shared data via the hook and navigates to /open.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/';
    return path;
  } catch {
    return '/';
  }
}
