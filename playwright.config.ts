import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    // Use an installed Chromium browser when supplied; otherwise Playwright Chromium.
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'allow',
  },
  webServer: {
    command:
      'node node_modules/sirv-cli/bin.js build --single 200.html --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
