// Regression suite — GROWS one block per feature. CI runs ALL of it on every push/PR,
// so a new feature can't silently break an old one. (web-vanilla preset — Playwright.)
// This starter test just proves the toolchain is green on day one; replace/extend as you build.
const { test, expect } = require('@playwright/test');

test('starter — the app loads and shows its title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="title"]')).toBeVisible();
});
