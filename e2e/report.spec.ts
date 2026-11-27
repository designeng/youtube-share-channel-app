import { expect, openVideo, test, VIDEO_ID } from './fixtures';

test('an AI review can be reported without leaving the app', async ({ page }) => {
  const reports: Record<string, string>[] = [];
  let status = 500;
  await page.route('https://reports.example/ai', (route) => {
    const preflight = route.request().method() === 'OPTIONS';
    if (!preflight) reports.push(route.request().postDataJSON());
    return route.fulfill({
      status: preflight ? 204 : status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    });
  });
  await openVideo(page);
  await page.getByTestId('mode-ai').click();
  await page.getByTestId('ai-overview').click();
  await page.getByRole('button', { name: 'Пожаловаться' }).click();

  const dialog = page.getByTestId('report-dialog');
  await expect(dialog.getByTestId('report-send')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Неверно' }).click();
  await dialog.getByRole('textbox').fill('Это неправда');
  await dialog.getByTestId('report-send').click();
  await expect(dialog.getByText('Не удалось отправить жалобу', { exact: false })).toBeVisible();

  status = 200;
  await dialog.getByTestId('report-send').click();
  await expect(dialog.getByText('жалоба отправлена', { exact: false })).toBeVisible();
  expect(reports.at(-1)).toMatchObject({ reason: 'inaccurate', comment: 'Это неправда', videoId: VIDEO_ID, target: 'all' });
  expect(reports.at(-1)!.text).toContain('Общий обзор видео');
  expect(JSON.stringify(reports)).not.toContain('fake-gemini-key');

  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toBeHidden();
});
