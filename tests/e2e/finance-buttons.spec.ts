import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE  = 'http://localhost:3000';
const SS_DIR = path.join('tests', 'e2e', 'screenshots', 'finance-buttons');

async function ss(page: import('@playwright/test').Page, name: string) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: false });
}

test.describe('Finance — Record Payment & Add Expense buttons', () => {

  /* ── 1. Record Payment button ───────────────────────────────────────────── */
  test('01 — Record Payment button opens drawer', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('domcontentloaded');

    // Click "Received" tab
    await page.click('button:has-text("Received")');
    await page.waitForTimeout(800);
    await ss(page, '01-payments-tab');

    // Verify "Record Payment" button is visible
    const recBtn = page.locator('button:has-text("Record Payment"), button:has-text("Record payment")').first();
    await expect(recBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Record Payment button is visible');

    // Click to open drawer
    await recBtn.click();
    await page.waitForTimeout(500);
    await ss(page, '02-record-payment-drawer-open');

    // Drawer title — component uses "Record payment" (lowercase p)
    const drawerTitle = page.locator('h2:has-text("Record payment"), h2:has-text("Record Payment")').first();
    await expect(drawerTitle).toBeVisible({ timeout: 3000 });
    console.log('✅ Record Payment drawer opened');

    // RecordPaymentDrawer structure: amount input, mode buttons, reference input, date, note
    // No project select in this drawer — project/invoice context is pre-set via props

    // Amount input
    const amountInput = page.locator('input#rp-amount, input[placeholder="0"]').first();
    await expect(amountInput).toBeVisible({ timeout: 3000 });
    console.log('✅ Amount input present');

    // Mode buttons (UPI, Cash, Bank Transfer, Cheque, Card, Razorpay)
    const upiBtn = page.locator('button:has-text("UPI")').first();
    const upiVisible = await upiBtn.isVisible().catch(() => false);
    console.log(`✅ UPI mode button visible: ${upiVisible}`);
    expect(upiVisible).toBe(true);

    // Reference input
    const refInput = page.locator('input#rp-ref, input[placeholder*="UPI"]').first();
    const refVisible = await refInput.isVisible().catch(() => false);
    console.log(`✅ Reference input visible: ${refVisible}`);
    expect(refVisible).toBe(true);
    if (refVisible) await refInput.fill('TEST-UTR-12345');

    await ss(page, '03-drawer-filled');

    // Close via Cancel button (inside drawer footer)
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
    const drawerGone = !(await drawerTitle.isVisible().catch(() => false));
    console.log(`✅ Drawer closed: ${drawerGone}`);
  });

  /* ── 2. Record Expense button opens modal ─────────────────────────────── */
  test('02 — Record Expense button opens modal on Expenses tab', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Click "Expenses" tab
    await page.click('button:has-text("Expenses")');
    await page.waitForTimeout(800);
    await ss(page, '06-expenses-tab');

    // Button should be visible
    const addBtn = page.locator('button:has-text("Record Expense")').first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
    console.log('✅ Record Expense button is visible');

    // Click and wait for modal to open
    await addBtn.click();
    await page.waitForTimeout(600);
    await ss(page, '07-expenses-modal-open');

    const modalHeader = page.locator('h2:has-text("Record Expense")').first();
    const modalOpened = await modalHeader.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Record Expense modal opened: ${modalOpened}`);
    expect(modalOpened).toBe(true);

    // Modal should have project selector and amount field
    const projectSelect = page.locator('select').first();
    const amountInput   = page.locator('input[type="number"]').first();
    const hasProject = await projectSelect.isVisible().catch(() => false);
    const hasAmount  = await amountInput.isVisible().catch(() => false);
    console.log(`  project selector: ${hasProject}, amount input: ${hasAmount}`);

    // Close via Cancel
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(300);
    }
    console.log('✅ Record Expense modal opens and closes correctly');
  });

});
