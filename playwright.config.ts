import { defineConfig, devices } from '@playwright/test';

const PORT = 8199;

/** Browser UI tests on the web build with synthetic data (see e2e/fixtures.ts). */
export default defineConfig({
  testDir: './e2e',
  // EXPO_PUBLIC_APP_VARIANT=play npm run e2e builds the Play variant and runs its own test only.
  ...(process.env.EXPO_PUBLIC_APP_VARIANT === 'play' ? { testMatch: 'play.spec.ts' } : { testIgnore: 'play.spec.ts' }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx expo export -p web && node e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { EXPO_PUBLIC_REPORT_URL: 'https://reports.example/ai' },
    timeout: 240_000,
  },
});
