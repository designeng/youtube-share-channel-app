/**
 * Synthetic backend: every request that leaves localhost is answered here, so tests need no API keys
 * or network. The YouTube IFrame API is replaced with a fake whose clock the tests control.
 */
import { test as base, expect, type Page, type Route } from '@playwright/test';

export const VIDEO_ID = 'e2eVideo001';
export const DURATION_SEC = 600;
export const CHAPTERS = ['Вступление', 'Основная часть', 'Выводы'];

/** One caption every 5 s; the app groups them into 10 s lines, so line N starts at N*10 s. */
const SEGMENTS = Array.from({ length: DURATION_SEC / 5 }, (_, i) => ({
  tStartMs: i * 5000,
  dDurationMs: 5000,
  segs: [{ utf8: `Синтетическая реплика номер ${i}.` }],
}));

const VIDEO = {
  id: VIDEO_ID,
  snippet: {
    title: 'Синтетическое видео для тестов',
    publishedAt: '2026-01-15T12:00:00Z',
    description: `Тестовое описание.\n0:00 ${CHAPTERS[0]}\n3:00 ${CHAPTERS[1]}\n6:00 ${CHAPTERS[2]}`,
    channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
    channelTitle: 'Тестовый канал',
    defaultAudioLanguage: 'ru',
  },
  contentDetails: { duration: 'PT10M' },
  statistics: { viewCount: '12345', likeCount: '678' },
};

const FAKE_IFRAME_API = `
window.__yt = { time: 0, seeks: [] };
window.YT = { Player: function (el, opts) {
  var node = document.createElement('div');
  node.setAttribute('data-testid', 'fake-player');
  node.textContent = 'fake player ' + opts.videoId;
  node.style.cssText = 'color:#fff;width:100%;height:100%';
  el.replaceWith(node);
  this.seekTo = function (s) { window.__yt.time = s; window.__yt.seeks.push(s); };
  this.playVideo = function () {};
  this.pauseVideo = function () {};
  this.getCurrentTime = function () { return window.__yt.time; };
  this.destroy = function () { node.remove(); };
  setTimeout(function () { opts.events.onReady(); }, 0);
} };
if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
`;

type YtWindow = Window & { __yt: { time: number; seeks: number[] } };

/** Moves the fake playback position, as if the video had played up to `sec`. */
export const playTo = (page: Page, sec: number) =>
  page.evaluate((s) => {
    (window as unknown as YtWindow).__yt.time = s;
  }, sec);

export const lastSeek = (page: Page) => page.evaluate(() => (window as unknown as YtWindow).__yt.seeks.at(-1));

const json = (route: Route, body: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });

async function mockBackend(page: Page) {
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/videos')) return json(route, { items: [VIDEO] });
      if (url.pathname === '/iframe_api')
        return route.fulfill({ contentType: 'text/javascript', body: FAKE_IFRAME_API });
      if (url.pathname === '/youtubei/v1/player')
        return json(route, {
          streamingData: {
            formats: [{ itag: 18, url: 'https://rr1.googlevideo.com/videoplayback', mimeType: 'video/mp4', qualityLabel: '360p', contentLength: '4096' }],
          },
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  languageCode: 'ru',
                  name: { simpleText: 'Русский' },
                  isTranslatable: true,
                  baseUrl: 'https://www.youtube.com/api/timedtext?lang=ru',
                },
              ],
            },
          },
        });
      if (url.pathname === '/videoplayback')
        return route.fulfill({ contentType: 'video/mp4', headers: { 'Access-Control-Allow-Origin': '*' }, body: '0'.repeat(4096) });
      if (url.pathname === '/api/timedtext') return json(route, { events: SEGMENTS });
      if (url.hostname === 'generativelanguage.googleapis.com') {
        const prompt: string = route.request().postDataJSON().contents[0].parts[0].text;
        const chapter = prompt.match(/Глава \d+ из \d+: «([^»]+)»/)?.[1];
        const title = chapter ? `Обзор главы «${chapter}»` : 'Общий обзор видео';
        return json(route, {
          candidates: [{ content: { parts: [{ text: `### ${title}\n- Ключевой момент [4:10]` }] } }],
        });
      }
      return route.abort();
    },
  );
}

export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockBackend(page);
    // Fake API keys, stored where src/lib/secureStore.web.ts looks for them.
    await page.addInitScript(() => {
      localStorage.setItem('secure:youtubeKey', 'fake-youtube-key');
      localStorage.setItem('secure:geminiKey', 'fake-gemini-key');
    });
    await provide(page);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  },
});

export async function openVideo(page: Page) {
  await page.goto(`/video/${VIDEO_ID}`);
  await expect(page.getByTestId('fake-player')).toBeVisible();
  await expect(page.getByTestId('chapter-0')).toBeVisible();
}

export { expect };
