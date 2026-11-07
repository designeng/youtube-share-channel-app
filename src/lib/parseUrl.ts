export type ChannelRef =
  | { kind: 'channelId'; value: string }
  | { kind: 'handle'; value: string } // without "@"
  | { kind: 'user'; value: string }
  | { kind: 'custom'; value: string; url: string }
  | { kind: 'video'; value: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extracts a channel reference from arbitrary shared text (YouTube app shares "Title https://youtube.com/@x?si=..."). */
export function parseChannelRef(input: string): ChannelRef | null {
  const text = input.trim();
  if (!text) return null;

  const bareHandle = text.match(/^@([\w.\-·]{3,})$/u);
  if (bareHandle) return { kind: 'handle', value: bareHandle[1] };
  if (/^UC[\w-]{22}$/.test(text)) return { kind: 'channelId', value: text };

  const urlMatch = text.match(/https?:\/\/[^\s]+/i) ?? text.match(/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i);
  if (!urlMatch) return null;
  let url: URL;
  try {
    url = new URL(urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (host === 'youtu.be' && parts[0] && VIDEO_ID.test(parts[0])) return { kind: 'video', value: parts[0] };
  if (host !== 'youtube.com') return null;

  const [first, second] = parts;
  if (!first) return null;
  if (first.startsWith('@')) return { kind: 'handle', value: first.slice(1) };
  if (first === 'channel' && second) return { kind: 'channelId', value: second };
  if (first === 'user' && second) return { kind: 'user', value: second };
  if (first === 'c' && second) return { kind: 'custom', value: second, url: `https://www.youtube.com/c/${second}` };
  if (first === 'watch') {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return { kind: 'video', value: v };
  }
  if (['shorts', 'live', 'embed', 'v'].includes(first) && second && VIDEO_ID.test(second))
    return { kind: 'video', value: second };
  // Legacy vanity URL: youtube.com/SomeName
  if (/^[\w.-]+$/.test(first) && !['feed', 'playlist', 'results'].includes(first))
    return { kind: 'custom', value: first, url: `https://www.youtube.com/${first}` };
  return null;
}
