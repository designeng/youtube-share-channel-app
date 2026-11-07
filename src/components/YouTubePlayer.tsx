/**
 * Official YouTube embedded player (IFrame Player API) inside a WebView.
 * The page is served with an https baseUrl so the embed receives an Origin/Referer –
 * YouTube rejects embeds without one (player errors 152/153).
 */
import { forwardRef, useImperativeHandle, useMemo, useRef, type ComponentType, type Ref } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

// react-native-webview 14 typings collapse to `never` under RN 0.88 types; use a narrow local type.
type WebViewRef = { injectJavaScript: (js: string) => void };
type NavRequest = { url: string; isTopFrame?: boolean };
const WebView = RNWebView as unknown as ComponentType<Record<string, unknown> & { ref?: Ref<WebViewRef> }>;

const ORIGIN = 'https://channelviewer.app';

export type PlayerHandle = {
  seekTo: (sec: number) => void;
  play: () => void;
  pause: () => void;
};

type Props = {
  videoId: string;
  height: number;
  startSec?: number;
  onTime?: (sec: number) => void;
  onError?: (code: number) => void;
  onReady?: () => void;
};

const html = (videoId: string, start: number) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}#p{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script>
  function post(o){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(o));}
  var player;
  var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
  function onYouTubeIframeAPIReady(){
    player=new YT.Player('p',{
      width:'100%',height:'100%',videoId:${JSON.stringify(videoId)},
      playerVars:{playsinline:1,rel:0,start:${Math.floor(start)},origin:${JSON.stringify(ORIGIN)},enablejsapi:1},
      events:{
        onReady:function(){post({type:'ready'});
          setInterval(function(){try{post({type:'time',t:player.getCurrentTime()})}catch(e){}},1000);},
        onStateChange:function(e){post({type:'state',s:e.data})},
        onError:function(e){post({type:'error',code:e.data})}
      }});
  }
</script></body></html>`;

export const YouTubePlayer = forwardRef<PlayerHandle, Props>(function YouTubePlayer(
  { videoId, height, startSec = 0, onTime, onError, onReady },
  ref,
) {
  const web = useRef<WebViewRef>(null);
  // Only rebuild the page when the video changes (not on every startSec change).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => ({ html: html(videoId, startSec), baseUrl: ORIGIN }), [videoId]);

  const run = (js: string) => web.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  useImperativeHandle(ref, () => ({
    seekTo: (sec) => run(`player.seekTo(${Math.max(0, sec)},true);player.playVideo();`),
    play: () => run('player.playVideo();'),
    pause: () => run('player.pauseVideo();'),
  }));

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'time') onTime?.(msg.t);
      else if (msg.type === 'error') onError?.(msg.code);
      else if (msg.type === 'ready') onReady?.();
    } catch {}
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={web}
        source={source}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req: NavRequest) => {
          // Let the embed and its sub-frames load; open anything else (YouTube logo, "Watch on YouTube") externally.
          if (req.url.startsWith(ORIGIN) || req.url === 'about:blank' || req.isTopFrame === false) return true;
          if (/youtube\.com\/(embed|iframe_api|s\/player)/.test(req.url)) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
});

/** Human readable IFrame API error codes. */
export function playerErrorText(code: number): string {
  if (code === 101 || code === 150) return 'Автор запретил встраивание этого видео.';
  if (code === 100) return 'Видео удалено или приватное.';
  if (code === 152 || code === 153) return 'Плеер отклонил встраивание (ошибка конфигурации).';
  return `Ошибка плеера (${code}).`;
}
