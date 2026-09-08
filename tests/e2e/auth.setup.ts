import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'tests/e2e/.auth/owner.json';

setup('authenticate as owner', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'mohasher11@gmail.com');
  await page.fill('#password', 'KonstDesign@2026');
  await page.click('button[type=submit]');
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 30000 });
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: AUTH_FILE });
});
