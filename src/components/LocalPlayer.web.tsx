/** Web counterpart of LocalPlayer.tsx, for the browser tests. */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { LocalPlayerProps, PlayerHandle } from './player';

export const LocalPlayer = forwardRef<PlayerHandle, LocalPlayerProps>(function LocalPlayer(
  { uri, height, startSec = 0, onTime },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    seekTo: (sec) => {
      if (video.current) video.current.currentTime = Math.max(0, sec);
    },
    play: () => void video.current?.play(),
    pause: () => video.current?.pause(),
  }));
  return (
    <video
      ref={video}
      data-testid="local-player"
      src={`${uri}#t=${Math.floor(startSec)}`}
      controls
      style={{ width: '100%', height, background: '#000' }}
      onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
    />
  );
});
