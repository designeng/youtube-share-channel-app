import { CHAPTERS, expect, openVideo, test, VIDEO_ID } from './fixtures';
import type { Page } from '@playwright/test';

type NetWindow = Window & { __network?: string };

const setNetwork = (page: Page, kind: 'wifi' | 'metered') =>
  page.evaluate((k) => {
    (window as NetWindow).__network = k;
  }, kind);

async function download(page: Page) {
  await page.getByTestId('download-start').click();
  await expect(page.getByTestId('download-delete')).toBeVisible();
}

test('downloads over Wi-Fi and works without a network afterwards', async ({ page }) => {
  await openVideo(page);
  await download(page);
  await expect(page.getByTestId('download-bar')).toContainText('Скачано');
  // The fake backend has Russian captions only and no translation.
  await expect(page.getByTestId('download-bar')).toContainText('Нет субтитров: en');

  // Everything but the app itself is unreachable now.
  await page.unrouteAll();
  const requested: string[] = [];
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) => {
      requested.push(route.request().url());
      return route.abort();
    },
  );
  await page.reload();
  await expect(page.getByTestId('local-player')).toBeVisible();
  await expect(page.getByTestId('chapter-2')).toContainText(CHAPTERS[2]);
  await page.getByTestId('mode-transcript').click();
  await expect(page.getByTestId('transcript-line-0')).toBeVisible();
  expect(requested.filter((u) => !u.includes('videoplayback'))).toEqual([]);
});

test('warns on mobile data and downloads only when allowed', async ({ page }) => {
  await openVideo(page);
  await setNetwork(page, 'metered');

  let warning = '';
  page.once('dialog', (d) => {
    warning = d.message();
    void d.dismiss();
  });
  await page.getByTestId('download-start').click();
  await expect(page.getByTestId('download-start')).toContainText('Скачать');
  expect(warning).toContain('Мобильная сеть');
  await expect(page.getByTestId('download-delete')).toHaveCount(0);

  page.once('dialog', (d) => void d.accept());
  await download(page);
});

test('lists downloaded videos and deletes them', async ({ page }) => {
  await openVideo(page);
  await download(page);

  await page.goto('/downloads');
  await expect(page.getByTestId(`download-${VIDEO_ID}`)).toContainText('Синтетическое видео');
  await expect(page.getByTestId('downloads-summary')).toContainText('Видео: 1');

  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('delete-all').click();
  await expect(page.getByTestId('downloads-summary')).toContainText('Пока ничего не скачано');
});

test('keeps AI reviews with the downloaded video after the cache is gone', async ({ page }) => {
  await openVideo(page);
  // One review before the download and one after it, with caching that would forget them.
  await page.getByTestId('chapter-ai-0').click();
  await expect(page.getByText(`Обзор главы «${CHAPTERS[0]}»`)).toBeVisible();
  await download(page);
  await page.getByTestId('ai-overview').click();
  await expect(page.getByText('Общий обзор видео')).toBeVisible();

  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('review.'))
      .forEach((k) => localStorage.removeItem(k)),
  );
  await page.unrouteAll();
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) => route.abort(),
  );
  await page.reload();
  await page.getByTestId('mode-ai').click();
  await page.getByTestId('ai-overview').click();
  await expect(page.getByText('Общий обзор видео')).toBeVisible();
  await page.getByTestId('ai-chapter-0').click();
  await expect(page.getByText(`Обзор главы «${CHAPTERS[0]}»`)).toBeVisible();
});
