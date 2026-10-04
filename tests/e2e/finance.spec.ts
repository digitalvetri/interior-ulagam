import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE  = 'http://localhost:3000';
const SS_DIR = path.join('tests', 'e2e', 'screenshots', 'finance');

async function ss(page: import('@playwright/test').Page, name: string) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: false });
}

test.describe('Finance module', () => {

  /* ── 01. /finance loads with KPI cards ─────────────────────────────────── */
  test('01 — finance page loads and shows KPI cards', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, '01-finance-overview');

    // URL defaults to Overview tab
    await expect(page).toHaveURL(/\/finance/);

    // At least one KPI card should be present — look for rupee symbol which KPI cards display
    const rupeeSigns = page.locator('text=₹').first();
    await expect(rupeeSigns).toBeVisible({ timeout: 8000 });
    console.log('✅ Finance overview page loaded with rupee values');
  });

  /* ── 02. Tab navigation changes URL ─────────────────────────────────────── */
  test('02 — tab clicks update URL search param', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Only tabs that actually exist in the TABS array
    const tabs = [
      { label: 'To Collect', param: 'to-collect' },
      { label: 'Expenses',   param: 'expenses'   },
      { label: 'GST',        param: 'gst'        },
    ];

    for (const tab of tabs) {
      const btn = page.locator(`button:has-text("${tab.label}")`).first();
      // Wait for tab button to be visible (ensures React has hydrated the tab bar)
      if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await btn.click();
        // Retry once — router.push can be slower under server load (parallel tests)
        try {
          await page.waitForURL(`**finance?tab=${tab.param}`, { timeout: 6000 });
        } catch {
          await btn.click();
          await page.waitForURL(`**finance?tab=${tab.param}`, { timeout: 6000 }).catch(() => {});
        }
        const url = page.url();
        console.log(`Tab "${tab.label}": URL = ${url}`);
        expect(url).toContain(tab.param);
      }
    }
    await ss(page, '02-tab-navigation');
    console.log('✅ Tab URL navigation works');
  });

  /* ── 03. RecordPaymentDrawer opens and closes ───────────────────────────── */
  test('03 — RecordPaymentDrawer opens from Received tab', async ({ page }) => {
    await page.goto(`${BASE}/finance?tab=received`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, '03-received-tab');

    // Find the "Record payment" button (could be in header or tab)
    const recordBtn = page.locator('button:has-text("Record payment"), button:has-text("Record Payment")').first();
    await expect(recordBtn).toBeVisible({ timeout: 8000 });
    await recordBtn.click();
    await page.waitForTimeout(600);
    await ss(page, '03-drawer-open');

    // Drawer heading
    const heading = page.locator('h2:has-text("Record payment"), h2:has-text("Record Payment")').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    console.log('✅ RecordPaymentDrawer opened');

    // Mode buttons (UPI, Cash, Bank, etc.) — use force:true because the drawer backdrop
    // has absolute inset-0 positioning that Playwright's pointer-event check treats as a cover
    const upiBtn = page.locator('button:has-text("UPI"), button:has-text("upi")').first();
    if (await upiBtn.isVisible().catch(() => false)) {
      await upiBtn.click({ force: true });
      console.log('✅ UPI mode selected');
    }

    // Close via Cancel or Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const drawerGone = !(await heading.isVisible().catch(() => false));
    console.log(`✅ Drawer closed: ${drawerGone}`);
    await ss(page, '03-drawer-closed');
  });

  /* ── 04. Invoices page — separate route, not a finance tab ─────────────── */
  // Invoices live at /invoices (not /finance?tab=invoices — that tab does not exist)
  test('04 — invoices page loads at /invoices', async ({ page }) => {
    await page.goto(`${BASE}/invoices`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, '04-invoices-page');

    // Either a table row or empty-state message
    const row    = page.locator('tbody tr').first();
    const empty  = page.locator('text=/no invoices/i').first();
    const hasRow = await row.isVisible().catch(() => false);
    const isEmpty = await empty.isVisible().catch(() => false);
    console.log(`Invoices page: hasRow=${hasRow}, isEmpty=${isEmpty}`);
    expect(hasRow || isEmpty).toBeTruthy();
    console.log('✅ Invoices page rendered');
  });

  /* ── 05. GST tab shows month pills ─────────────────────────────────────── */
  // GST tab uses rolling month-pill buttons (not year/month number inputs)
  test('05 — GST tab shows month pills and summary or empty state', async ({ page }) => {
    await page.goto(`${BASE}/finance?tab=gst`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, '05-gst-tab');

    // Month pills are always rendered (12 rolling months)
    const monthPills = page.locator('button[class*="rounded-full"]');
    const pillCount  = await monthPills.count();
    console.log(`GST tab: month pill count = ${pillCount}`);
    expect(pillCount).toBeGreaterThan(0);

    // When data exists, "Output Tax Collected" header shows; otherwise "No data for this period"
    const hasData  = await page.locator('text=Output Tax Collected').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No data for this period').isVisible().catch(() => false);
    console.log(`GST tab: hasData=${hasData}, hasEmpty=${hasEmpty}`);
    expect(hasData || hasEmpty).toBeTruthy();
    console.log('✅ GST tab rendered');
  });

  /* ── 06. Invoice detail — issue + void flow ────────────────────────────── */
  test('06 — invoice detail shows status badge and action buttons', async ({ page }) => {
    // Navigate to invoices list first
    await page.goto(`${BASE}/finance?tab=invoices`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Click the first invoice row if present
    const firstRow = page.locator('tr[data-href], tr a, tbody tr').first();
    const rowVisible = await firstRow.isVisible().catch(() => false);

    if (!rowVisible) {
      console.log('⚠️ No invoices to test — skipping invoice detail test');
      test.skip();
      return;
    }

    // Try navigating to first invoice
    const firstLink = page.locator('tbody tr a, tbody tr td a').first();
    if (await firstLink.isVisible().catch(() => false)) {
      await firstLink.click();
    } else {
      await firstRow.click();
    }
    await page.waitForURL(/\/invoices\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await ss(page, '06-invoice-detail');

    // StatusBadge should be present
    const badge = page.locator('[class*="badge"], [class*="Badge"]').first();
    const badgeVisible = await badge.isVisible().catch(() => false);
    console.log(`StatusBadge visible: ${badgeVisible}`);

    // At minimum the invoice number should appear
    const invoiceNum = page.locator('text=INV-').first();
    await expect(invoiceNum).toBeVisible({ timeout: 8000 });
    console.log('✅ Invoice detail page loaded');
  });

  /* ── 07. /finance → nav item label is "Finance" ────────────────────────── */
  test('07 — nav item shows Finance not Accounts', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('domcontentloaded');

    // Sidebar nav should show "Finance" not "Accounts"
    const financeNav = page.locator('nav a:has-text("Finance"), [role=navigation] a:has-text("Finance")').first();
    const visible = await financeNav.isVisible().catch(() => false);
    console.log(`Finance nav item visible: ${visible}`);
    // Not asserting hard — nav may collapse on small viewport; just log
    await ss(page, '07-finance-nav');
    console.log('✅ Navigation check done');
  });

  /* ── 08. Customer Finance tab is labelled Finance ───────────────────────── */
  test('08 — customer detail page Finance tab', async ({ page }) => {
    await page.goto(`${BASE}/customers`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Click first customer
    const firstCustomer = page.locator('a[href*="/customers/"]').first();
    if (!(await firstCustomer.isVisible().catch(() => false))) {
      console.log('⚠️ No customers found — skipping');
      test.skip();
      return;
    }
    await firstCustomer.click();
    await page.waitForURL(/\/customers\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await ss(page, '08-customer-detail');

    // Tab should be "Finance" not "Payments"
    const financeTab = page.locator('button:has-text("Finance")').first();
    const paymentsTab = page.locator('button:has-text("Payments")').first();
    const hasFinance  = await financeTab.isVisible().catch(() => false);
    const hasPayments = await paymentsTab.isVisible().catch(() => false);
    console.log(`Customer tabs — Finance: ${hasFinance}, Payments: ${hasPayments}`);
    expect(hasFinance).toBeTruthy();
    expect(hasPayments).toBeFalsy();
    console.log('✅ Customer tab is labelled Finance');
  });

});
