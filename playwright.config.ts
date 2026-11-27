import { defineConfig, devices } from '@playwright/test';

const PORT = 8199;

/** Browser UI tests on the web build with synthetic data (see e2e/fixtures.ts). */
export default defineConfig({
  testDir: './e2e',
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
    timeout: 240_000,
  },
});
