import { CHAPTERS, expect, lastSeek, openVideo, playTo, test, VIDEO_ID } from './fixtures';

const SELECTED = ['aria-selected', 'true'] as const;

test.describe('bottom mode bar', () => {
  test('switches what is shown under the player', async ({ page }) => {
    await openVideo(page);
    await expect(page.getByTestId('mode-chapters')).toHaveAttribute(...SELECTED);

    for (const mode of ['transcript', 'ai', 'about', 'chapters']) {
      await page.getByTestId(`mode-${mode}`).click();
      await expect(page.getByTestId(`mode-${mode}`)).toHaveAttribute(...SELECTED);
      await expect(page.getByTestId(`panel-${mode}`)).toBeVisible();
      await expect(page.locator('[data-testid^="panel-"]')).toHaveCount(1);
      await expect(page.getByTestId('fake-player')).toBeInViewport();
    }
  });

  test('stays at the bottom of the screen while content scrolls', async ({ page }) => {
    await openVideo(page);
    await page.getByTestId('mode-transcript').click();
    const tab = page.getByTestId('mode-transcript');
    const before = (await tab.boundingBox())!;
    expect(page.viewportSize()!.height - (before.y + before.height)).toBeLessThan(2);

    await page.getByTestId('transcript-list').hover();
    await page.mouse.wheel(0, 2000);
    await expect(page.getByTestId('transcript-line-0')).not.toBeInViewport();
    expect(await tab.boundingBox()).toEqual(before);
  });
});

test.describe('timecodes', () => {
  test('highlight the chapter being played and seek on tap', async ({ page }) => {
    await openVideo(page);
    await expect(page.getByTestId('chapter-0')).toHaveAttribute(...SELECTED);

    await playTo(page, 200);
    await expect(page.getByTestId('chapter-1')).toHaveAttribute(...SELECTED);
    await expect(page.getByTestId('chapter-0')).not.toHaveAttribute(...SELECTED);

    await page.getByTestId('chapter-2').getByText(CHAPTERS[2]).click();
    expect(await lastSeek(page)).toBe(360);
    await expect(page.getByTestId('chapter-2')).toHaveAttribute(...SELECTED);
  });
});

test.describe('transcript sync', () => {
  test.beforeEach(async ({ page }) => {
    await openVideo(page);
  });

  test('highlights the current line and scrolls to it in both directions', async ({ page }) => {
    await page.getByTestId('mode-transcript').click();
    await expect(page.getByTestId('transcript-line-0')).toHaveAttribute(...SELECTED);

    for (const [sec, line] of [
      [455, 45],
      [125, 12],
      [595, 59],
    ]) {
      await playTo(page, sec);
      const row = page.getByTestId(`transcript-line-${line}`);
      await expect(row).toHaveAttribute(...SELECTED);
      await expect(row).toBeInViewport({ ratio: 1 });
      await expect(page.locator('[data-testid^="transcript-line-"][aria-selected="true"]')).toHaveCount(1);
    }
  });

  test('opens already positioned at the current moment', async ({ page }) => {
    await playTo(page, 455);
    await expect(page.getByTestId('chapter-2')).toHaveAttribute(...SELECTED);

    await page.getByTestId('mode-transcript').click();
    await expect(page.getByTestId('transcript-line-45')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('transcript-line-45')).toHaveAttribute(...SELECTED);
  });

  test('stops following after a manual scroll and can return', async ({ page }) => {
    await page.getByTestId('mode-transcript').click();
    await expect(page.getByTestId('transcript-line-0')).toBeInViewport();
    await expect(page.getByTestId('transcript-follow')).toBeHidden();

    await page.getByTestId('transcript-list').hover();
    await page.mouse.wheel(0, 600);
    await expect(page.getByTestId('transcript-follow')).toBeVisible();
    await expect(page.getByTestId('transcript-line-0')).not.toBeInViewport();

    // Playback moves on, but the list must stay where the user left it.
    await playTo(page, 455);
    await expect(page.getByTestId('transcript-follow')).toContainText('7:35');
    await expect(page.getByTestId('transcript-line-45')).not.toBeInViewport();

    await page.getByTestId('transcript-follow').click();
    await expect(page.getByTestId('transcript-line-45')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('transcript-follow')).toBeHidden();
  });

  test('tapping a line seeks the video and resumes following', async ({ page }) => {
    await page.getByTestId('mode-transcript').click();
    await page.getByTestId('transcript-list').hover();
    await page.mouse.wheel(0, 100);
    await expect(page.getByTestId('transcript-follow')).toBeVisible();

    await page.getByTestId('transcript-line-5').click();
    expect(await lastSeek(page)).toBe(50);
    await expect(page.getByTestId('transcript-line-5')).toHaveAttribute(...SELECTED);
    await expect(page.getByTestId('transcript-follow')).toBeHidden();
  });
});

test.describe('AI review', () => {
  test('"AI" on a timecode opens the review mode for that chapter', async ({ page }) => {
    await openVideo(page);
    await page.getByTestId('chapter-ai-1').click();

    await expect(page.getByTestId('mode-ai')).toHaveAttribute(...SELECTED);
    await expect(page.getByText(`Обзор главы «${CHAPTERS[1]}»`)).toBeInViewport();

    await page.getByText('[4:10]').click();
    expect(await lastSeek(page)).toBe(250);
  });

  test('keeps generated reviews when switching modes', async ({ page }) => {
    await openVideo(page);
    await page.getByTestId('mode-ai').click();
    await page.getByTestId('ai-overview').click();
    await expect(page.getByText('Общий обзор видео')).toBeVisible();

    await page.getByTestId('mode-transcript').click();
    await page.getByTestId('mode-ai').click();
    await expect(page.getByText('Общий обзор видео')).toBeVisible();
  });

  test('reviews all chapters one by one', async ({ page }) => {
    await openVideo(page);
    await page.getByTestId('mode-ai').click();
    await page.getByTestId('ai-run-all').click();
    for (const title of CHAPTERS) await expect(page.getByText(`Обзор главы «${title}»`)).toBeVisible();
  });
});

test('description mode shows details with tappable timecodes', async ({ page }) => {
  await openVideo(page);
  await page.getByTestId('mode-about').click();
  const about = page.getByTestId('panel-about');
  await expect(about).toContainText('Тестовый канал');
  await about.getByText('3:00').click();
  expect(await lastSeek(page)).toBe(180);
});

test('a pasted video link can be opened from the home screen', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('youtube.com/@handle').fill(`https://youtu.be/${VIDEO_ID}`);
  await page.getByText('Открыть только это видео').click();
  await page.getByText('Открыть', { exact: true }).click();
  await expect(page.getByTestId('fake-player')).toBeVisible();
  await expect(page.getByTestId('mode-chapters')).toBeVisible();
});
