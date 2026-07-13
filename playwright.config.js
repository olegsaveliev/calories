// CI/test config (dev-only). Serves src/ as a static site and runs the regression suite headless.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  use: { baseURL: 'http://localhost:8080', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 -m http.server 8080 --directory src',
    url: 'http://localhost:8080/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
