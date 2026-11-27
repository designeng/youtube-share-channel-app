/** Plays a downloaded file; same handle and callbacks as the YouTube player. */
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useImperativeHandle } from 'react';
import { PLAYER_POLL_MS, type LocalPlayerProps, type PlayerHandle } from './player';

export const LocalPlayer = forwardRef<PlayerHandle, LocalPlayerProps>(function LocalPlayer(
  { uri, height, startSec = 0, onTime, onError },
  ref,
) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = PLAYER_POLL_MS / 1000;
    if (startSec) p.currentTime = startSec;
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => onTime?.(currentTime));
  useEventListener(player, 'statusChange', ({ status }) => status === 'error' && onError?.());

  useImperativeHandle(ref, () => ({
    seekTo: (sec) => {
      player.currentTime = Math.max(0, sec);
      player.play();
    },
    play: () => player.play(),
    pause: () => player.pause(),
  }));

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height, backgroundColor: '#000' }}
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
});
