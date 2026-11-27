/** The Play build has no downloads: an old link to the screen leads home. */
import { Redirect } from 'expo-router';

export default function DownloadsScreen() {
  return <Redirect href="/" />;
}
