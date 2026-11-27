import { expect, openVideo, test } from './fixtures';

test('translates subtitles with AI only when asked to', async ({ page }) => {
  let aiRequests = 0;
  // English is wanted, YouTube has Russian only and refuses to translate it.
  await page.addInitScript(() => localStorage.setItem('prefs.v1', JSON.stringify({ transcriptLang: 'en' })));
  await page.route('**/youtubei/v1/player*', (route) =>
    route.fulfill({
      json: {
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
            translationLanguages: [{ languageCode: 'en', languageName: { simpleText: 'English' } }],
          },
        },
      },
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.route('**/api/timedtext*tlang=*', (route) =>
    route.fulfill({ status: 429, body: '<html></html>', headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    aiRequests++;
    const prompt: string = route.request().postDataJSON().contents[0].parts[0].text;
    const text = [...prompt.matchAll(/^(\d+)\|/gm)].map((m) => `${m[1]}|Translated line ${m[1]}`).join('\n');
    return route.fulfill({
      json: { candidates: [{ content: { parts: [{ text }] } }] },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });

  await openVideo(page);
  await page.getByTestId('mode-transcript').click();
  const translate = page.getByRole('button', { name: 'Перевести с помощью AI' });
  const first = page.getByTestId('transcript-line-0');
  await expect(translate).toBeVisible();
  await expect(first).toContainText('Синтетическая реплика');

  // The notice can be closed; tapping the translation chip, even repeatedly, loads again and brings it back.
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(translate).toBeHidden();
  const chip = page.getByText('Перевод → en');
  for (let i = 0; i < 2; i++) {
    await chip.click();
    await expect(translate).toBeVisible();
    await expect(first).toBeVisible();
  }
  expect(aiRequests).toBe(0);

  await translate.click();
  await expect(first).toContainText('Translated line 1');
  await expect(translate).toBeHidden();
  await expect(page.getByTestId('transcript-line-1')).toContainText('0:10');
  expect(aiRequests).toBe(1);
});
