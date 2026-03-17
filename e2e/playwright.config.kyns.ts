import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'e2e/.env.e2e') });
dotenv.config();

export default defineConfig({
  globalSetup: require.resolve('./setup/global-setup.kyns'),
  globalTeardown: require.resolve('./setup/global-teardown.kyns'),
  testDir: 'specs/',
  testMatch: /kyns-.*\.spec\.ts/,
  outputDir: 'specs/.test-results-kyns',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-kyns', open: 'never' }],
  ],
  use: {
    baseURL: 'https://chat.kyns.ai',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: false,
    headless: true,
    storageState: path.resolve(process.cwd(), 'e2e/storageState.kyns.json'),
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
