import { expect, openVideo, test } from './fixtures';

test.describe('English system', () => {
  test.use({ locale: 'en-US' });

  test('shows the UI in English', async ({ page }) => {
    await openVideo(page);
    await expect(page.getByTestId('mode-chapters')).toContainText('Timecodes');
    await expect(page.getByTestId('download-bar')).toContainText('Watch offline');
    await page.goto('/settings');
    await expect(page.getByText('Changes are saved automatically.')).toBeVisible();
    // Languages the user has not chosen follow the system too.
    await expect(page.getByLabel('Subtitle language')).toHaveValue('en');
    await expect(page.getByLabel('Review language')).toHaveValue('English');
  });
});

test.describe('unsupported system language', () => {
  test.use({ locale: 'de-DE' });

  test('falls back to English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('How to open a channel')).toBeVisible();
  });
});

test('follows the system appearance, also while running', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const title = page.getByText('Как открыть канал');
  await expect(title).toHaveCSS('color', 'rgb(19, 19, 22)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(title).toHaveCSS('color', 'rgb(236, 236, 240)');
});
