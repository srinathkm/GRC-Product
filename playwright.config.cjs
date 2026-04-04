const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5174',
    cwd: path.join(__dirname, 'client'),
    url: 'http://127.0.0.1:5174',
    timeout: 60000,
    reuseExistingServer: !process.env.CI,
  },
});
