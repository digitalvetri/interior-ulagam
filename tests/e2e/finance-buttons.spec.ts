import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE  = 'http://localhost:3000';
const EMAIL = 'mohasher11@gmail.com';
const PASS  = 'KonstDesign@2026';
const SS_DIR = path.join('tests', 'e2e', 'screenshots', 'finance-buttons');

async function ss(page: import('@playwright/test').Page, name: string) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: false });
}

test.describe('Finance — Record Payment & Add Expense buttons', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
  });

  /* ── 1. Record Payment button ───────────────────────────────────────────── */
  test('01 — Record Payment button opens modal', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('domcontentloaded');

    // Click "Payments received" tab
    await page.click('button:has-text("Payments received")');
    await page.waitForTimeout(800);
    await ss(page, '01-payments-tab');

    // Verify "Record Payment" button is visible
    const recBtn = page.locator('button:has-text("Record Payment")');
    await expect(recBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Record Payment button is visible');

    // Click to open modal
    await recBtn.click();
    await page.waitForTimeout(500);
    await ss(page, '02-record-payment-modal-open');

    // Modal header
    const modalHeader = page.locator('h2:has-text("Record Payment")');
    await expect(modalHeader).toBeVisible({ timeout: 3000 });
    console.log('✅ Record Payment modal opened');

    // Project selector should be visible and loading projects
    const projSelect = page.locator('select').first();
    await expect(projSelect).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000); // wait for projects to load

    // Count project options
    const projOptions = await projSelect.locator('option').count();
    console.log(`  Project options loaded: ${projOptions}`);
    expect(projOptions).toBeGreaterThan(1); // at least "Select a project…" + 1 real project

    await ss(page, '03-projects-loaded');

    // Select the first real project
    const firstProjValue = await projSelect.locator('option:nth-child(2)').getAttribute('value');
    if (firstProjValue) {
      await projSelect.selectOption(firstProjValue);
      console.log(`  Selected project: ${firstProjValue}`);
      await page.waitForTimeout(1000); // wait for invoices to load
      await ss(page, '04-project-selected');

      // Check if unpaid invoices loaded or empty state shown
      const invoiceSelect = page.locator('select').nth(1);
      const noInvMsg = page.locator('text=No unpaid invoices');
      const invVisible = await invoiceSelect.isVisible().catch(() => false);
      const noInvVisible = await noInvMsg.isVisible().catch(() => false);
      console.log(`  Invoice select visible: ${invVisible}, No-invoices msg: ${noInvVisible}`);
      expect(invVisible || noInvVisible).toBeTruthy();
    }

    // Fill reference note
    const refInput = page.locator('input[placeholder*="UTR"]');
    await expect(refInput).toBeVisible({ timeout: 3000 });
    await refInput.fill('TEST-UTR-12345');
    console.log('✅ Reference note filled');
    await ss(page, '05-note-filled');

    // Close modal
    await page.keyboard.press('Escape');
    // Or click Cancel
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
    await page.waitForTimeout(400);
    console.log('✅ Modal closed');
  });

  /* ── 2. Add Expense button ──────────────────────────────────────────────── */
  test('02 — Add Expense button opens modal with all fields', async ({ page }) => {
    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('domcontentloaded');

    // Click "Expenses" tab
    await page.click('button:has-text("Expenses")');
    await page.waitForTimeout(800);
    await ss(page, '06-expenses-tab');

    // Verify "Add Expense" button is visible
    const addBtn = page.locator('button:has-text("Add Expense")');
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Add Expense button is visible');

    // Click to open modal
    await addBtn.click();
    await page.waitForTimeout(500);
    await ss(page, '07-log-expense-modal-open');

    // Modal header
    const modalHeader = page.locator('h2:has-text("Log Expense")');
    await expect(modalHeader).toBeVisible({ timeout: 3000 });
    console.log('✅ Log Expense modal opened');

    // Project selector
    const projSelect = page.locator('select').first();
    await expect(projSelect).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000); // wait for projects to load

    const projOptions = await projSelect.locator('option').count();
    console.log(`  Project options: ${projOptions}`);
    expect(projOptions).toBeGreaterThan(1);
    await ss(page, '08-expense-projects-loaded');

    // Category pills — all 5 should be present
    const categories = ['Petty Cash', 'Transport', 'Labour', 'Material', 'Other'];
    for (const cat of categories) {
      const pill = page.locator(`button:has-text("${cat}")`);
      const visible = await pill.isVisible().catch(() => false);
      console.log(`  Category pill "${cat}": ${visible ? '✅' : '❌'}`);
      expect(visible).toBeTruthy();
    }
    await ss(page, '09-category-pills');

    // Click "Transport" category
    await page.click('button:has-text("Transport")');
    await page.waitForTimeout(200);
    console.log('✅ Transport category selected');

    // Amount field
    const amountInput = page.locator('input[placeholder*="5000"]');
    await expect(amountInput).toBeVisible({ timeout: 3000 });
    await amountInput.fill('500');

    // GST rate — scope to inside the modal overlay (fixed inset-0)
    // DOM order inside modal: select[0]=project, select[1]=GST rate
    const gstSelect = page.locator('.fixed select').nth(1);
    await gstSelect.selectOption('18');
    console.log('✅ Amount 500, GST 18% set');

    // Vendor
    const vendorInput = page.locator('input[placeholder*="Vendor"]');
    await expect(vendorInput).toBeVisible({ timeout: 3000 });
    await vendorInput.fill('Ola Cabs');

    // Description
    const descInput = page.locator('input[placeholder*="description"]');
    await expect(descInput).toBeVisible({ timeout: 3000 });
    await descInput.fill('Site measurement trip – Konst Design');
    await ss(page, '10-expense-form-filled');
    console.log('✅ All expense fields filled');

    // Select a project then try to submit
    const firstProjValue = await projSelect.locator('option:nth-child(2)').getAttribute('value');
    if (firstProjValue) {
      await projSelect.selectOption(firstProjValue);
      await page.waitForTimeout(500);
      await ss(page, '11-expense-project-selected');

      // Submit
      const logBtn = page.locator('button:has-text("Log Expense")');
      await expect(logBtn).toBeEnabled({ timeout: 3000 });
      await logBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, '12-expense-submitted');

      // Modal should close on success, or show error
      const modalStillOpen = await page.locator('h2:has-text("Log Expense")').isVisible().catch(() => false);
      if (!modalStillOpen) {
        console.log('✅ Expense logged successfully — modal closed');
      } else {
        const errMsg = await page.locator('[style*="danger"]').first().textContent().catch(() => '');
        console.log(`⚠️ Modal still open — error: ${errMsg}`);
      }
    }
  });

});
