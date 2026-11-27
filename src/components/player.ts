/** Types and helpers shared by the native (WebView) and web (iframe) players. */
export type PlayerHandle = {
  seekTo: (sec: number) => void;
  play: () => void;
  pause: () => void;
};

export type PlayerProps = {
  videoId: string;
  height: number;
  startSec?: number;
  onTime?: (sec: number) => void;
  onError?: (code: number) => void;
  onReady?: () => void;
};

export type LocalPlayerProps = {
  /** file on the device */
  uri: string;
  height: number;
  startSec?: number;
  onTime?: (sec: number) => void;
  onError?: () => void;
};

/** How often the current playback position is reported (drives the transcript highlight). */
export const PLAYER_POLL_MS = 500;

/** Human readable IFrame API error codes. */
export function playerErrorText(code: number): string {
  if (code === 101 || code === 150) return 'Автор запретил встраивание этого видео.';
  if (code === 100) return 'Видео удалено или приватное.';
  if (code === 152 || code === 153) return 'Плеер отклонил встраивание (ошибка конфигурации).';
  return `Ошибка плеера (${code}).`;
}
