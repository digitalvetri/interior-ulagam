import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('scripts/snap-out');
mkdirSync(OUT, { recursive: true });

const routes = [
  { path: '/dashboard', name: 'dashboard-dark' },
  { path: '/leads',     name: 'leads-dark' },
  { path: '/projects',  name: 'projects-dark' },
  { path: '/login',     name: 'login-dark' },
];

const browser = await chromium.launch();
try {
  for (const { path, name } of routes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log(`${name}: ok`);

    // Also grab a light-mode snapshot for the same route
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      try { localStorage.setItem('theme', 'light'); } catch {}
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name.replace('-dark', '-light')}.png`, fullPage: false });
    console.log(`${name.replace('-dark', '-light')}: ok`);

    await ctx.close();
  }
} finally {
  await browser.close();
}
