/** Runs against the Play build only: EXPO_PUBLIC_APP_VARIANT=play npm run e2e */
import { expect, openVideo, test } from './fixtures';

test('has no downloads, no transcript and never calls private YouTube endpoints', async ({ page }) => {
  const privateCalls: string[] = [];
  page.on('request', (r) => {
    if (/youtubei|timedtext|videoplayback|youtube\.com\/watch/.test(r.url())) privateCalls.push(r.url());
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Настройки' }).first()).toBeVisible();
  await expect(page.getByTestId('open-downloads')).toHaveCount(0);

  await page.goto('/downloads');
  await expect(page).toHaveURL(/\/$/);

  await openVideo(page);
  await expect(page.getByTestId('download-bar')).toHaveCount(0);
  await expect(page.getByTestId('mode-transcript')).toHaveCount(0);

  // Gemini gets the video itself.
  await page.getByTestId('mode-ai').click();
  const request = page.waitForRequest(/generativelanguage/);
  await page.getByTestId('ai-overview').click();
  expect((await request).postData()).toContain('fileUri');
  await expect(page.getByRole('button', { name: 'Пожаловаться' })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByLabel('Gemini API key')).toBeVisible();
  await expect(page.getByText('OpenRouter', { exact: false })).toHaveCount(0);
  await expect(page.getByTestId('wifi-only')).toHaveCount(0);
  expect(privateCalls).toEqual([]);
});
