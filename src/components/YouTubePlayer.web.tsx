/** Web counterpart of YouTubePlayer.tsx: the IFrame Player API directly in the page (no WebView). */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, type ViewInstance } from 'react-native';
import { PLAYER_POLL_MS, type PlayerHandle, type PlayerProps } from './player';

type YTPlayer = {
  seekTo: (sec: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<YTNamespace> | undefined;

function loadApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  apiPromise ??= new Promise((resolve) => {
    if (w.YT?.Player) return resolve(w.YT);
    w.onYouTubeIframeAPIReady = () => resolve(w.YT!);
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export const YouTubePlayer = forwardRef<PlayerHandle, PlayerProps>(function YouTubePlayer(
  { videoId, height, startSec = 0, onTime, onError, onReady },
  ref,
) {
  const wrap = useRef<ViewInstance>(null);
  const player = useRef<YTPlayer | null>(null);
  const callbacks = useRef({ onTime, onError, onReady, startSec });
  useEffect(() => {
    callbacks.current = { onTime, onError, onReady, startSec };
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let instance: YTPlayer | undefined;
    // YT.Player replaces the element it is given, so hand it a node React does not manage.
    const host = wrap.current as unknown as HTMLElement;
    const target = document.createElement('div');
    host.appendChild(target);

    loadApi().then((YT) => {
      if (cancelled) return;
      instance = new YT.Player(target, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: { playsinline: 1, rel: 0, start: Math.floor(callbacks.current.startSec) },
        events: {
          onReady: () => {
            player.current = instance!;
            callbacks.current.onReady?.();
            timer = setInterval(() => callbacks.current.onTime?.(instance!.getCurrentTime()), PLAYER_POLL_MS);
          },
          onError: (e: { data: number }) => callbacks.current.onError?.(e.data),
        },
      });
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      player.current = null;
      instance?.destroy();
      host.replaceChildren();
    };
  }, [videoId]);

  useImperativeHandle(ref, () => ({
    seekTo: (sec) => {
      player.current?.seekTo(Math.max(0, sec), true);
      player.current?.playVideo();
    },
    play: () => player.current?.playVideo(),
    pause: () => player.current?.pauseVideo(),
  }));

  return <View ref={wrap} style={{ width: '100%', height, backgroundColor: '#000' }} />;
});
