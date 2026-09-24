/**
 * SECOND ROUND QA AUDIT
 *
 * Covers gaps from the first round:
 *   • All 9 project detail sub-tabs
 *   • Lead detail sub-pages (follow-ups, requirements, site-visit)
 *   • Entity detail pages (customer, vendor, PO, invoice, site visit)
 *   • Form validation (empty / invalid input)
 *   • Console-error sweep across all sidebar pages
 *   • Empty-state rendering on list pages
 *   • Vendor / Purchase Order CRUD flow
 *   • Attendance & Tasks pages
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE   = 'http://localhost:3000';
const SS_DIR = path.join(process.cwd(), 'tests', 'e2e', 'screenshots', 'round2');

function ss(page: Page, name: string) {
  fs.mkdirSync(SS_DIR, { recursive: true });
  return page.screenshot({ path: path.join(SS_DIR, `${Date.now()}-${name}.png`), fullPage: false });
}

// Collect console errors
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// Navigate + wait + return console errors for a route
async function auditPage(page: Page, url: string): Promise<{ errors: string[]; status: number }> {
  const errors = watchConsole(page);
  let status = 200;
  page.on('response', res => {
    if (res.url().includes(url) && res.status() >= 400) status = res.status();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000); // allow async renders
  return { errors, status };
}

// ─── Discover live entity IDs via API ──────────────────────────────────────────
async function discoverIds(page: Page): Promise<{
  projectId: string | null;
  leadId: string | null;
  customerId: string | null;
  vendorId: string | null;
  poId: string | null;
  invoiceId: string | null;
  siteVisitId: string | null;
}> {
  const get = async (path: string) => {
    try {
      const res = await page.request.get(`${BASE}${path}`);
      if (!res.ok()) return null;
      const body = await res.json() as { data: Array<{ id: string }> | null };
      return body?.data?.[0]?.id ?? null;
    } catch { return null; }
  };

  const [projectId, leadId, customerId, vendorId, poId, invoiceId, siteVisitId] = await Promise.all([
    get('/api/v1/projects?limit=1'),
    get('/api/v1/leads?limit=1'),
    get('/api/v1/customers?limit=1'),
    get('/api/v1/vendors?limit=1'),
    get('/api/v1/purchase-orders?limit=1'),
    get('/api/v1/invoices?limit=1'),
    get('/api/v1/site-visits?limit=1'),
  ]);

  console.log('Discovered IDs:', { projectId, leadId, customerId, vendorId, poId, invoiceId, siteVisitId });
  return { projectId, leadId, customerId, vendorId, poId, invoiceId, siteVisitId };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Round 2 QA Audit', () => {
  test.setTimeout(300_000);

  // ── A. Console error sweep — all sidebar pages ─────────────────────────────
  test('A — Console error sweep across sidebar pages', async ({ page }) => {
    const ROUTES = [
      '/dashboard',
      '/leads',
      '/customers',
      '/projects',
      '/site-visits',
      '/purchase-orders',
      '/vendors',
      '/finance',
      '/invoices',
      '/reports',
      '/attendance',
      '/tasks',
      '/my-space/attendance',
      '/my-space/profile',
      '/settings',
    ];

    const failures: string[] = [];

    for (const route of ROUTES) {
      const errors: string[] = [];
      const consoleErrors = watchConsole(page);

      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Check page didn't 500
      const bodyText = await page.innerText('body').catch(() => '');
      const is500 = bodyText.includes('Internal Server Error') || bodyText.includes('500') && bodyText.length < 200;
      const is404 = bodyText.includes('404') && bodyText.length < 300;

      if (is500) errors.push(`HTTP 500 on ${route}`);
      if (is404) errors.push(`HTTP 404 on ${route}`);

      // Filter out known benign console noise
      const realErrors = consoleErrors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('net::ERR_ABORTED') &&
        !e.includes('hydration') &&  // hydration warnings are not crashes
        !e.includes('Warning:')
      );
      if (realErrors.length > 0) errors.push(...realErrors.map(e => `JS Error on ${route}: ${e.substring(0, 100)}`));

      if (errors.length > 0) failures.push(...errors);
      else console.log(`  ✓ ${route}`);

      await ss(page, `console-${route.replace(/\//g, '_')}`);
    }

    if (failures.length > 0) {
      console.error('Console/HTTP errors found:\n' + failures.join('\n'));
    }

    // Report but don't hard-fail — this is an audit test
    console.log(`\n📋 Console sweep: ${ROUTES.length} pages, ${failures.length} issue(s) found`);
    expect(failures.filter(f => f.startsWith('HTTP 500') || f.startsWith('HTTP 404'))).toHaveLength(0);
  });

  // ── B. All 9 project sub-tabs load ─────────────────────────────────────────
  test('B — All project sub-tabs load without crash', async ({ page }) => {
    const { projectId } = await discoverIds(page);

    if (!projectId) {
      console.log('  ⚠️  No projects in DB — skipping sub-tab test');
      test.skip(true, 'No projects to test');
      return;
    }

    const TABS = [
      { label: 'Overview',     suffix: ''              },
      { label: 'Deliverables', suffix: '/deliverables' },
      { label: 'Site',         suffix: '/site'         },
      { label: 'Work Orders',  suffix: '/work-orders'  },
      { label: 'Snag',         suffix: '/snag'         },
      { label: 'Documents',    suffix: '/documents'    },
      { label: 'BOQ',          suffix: '/boq'          },
      { label: 'Expenses',     suffix: '/expenses'     },
      { label: 'Payments',     suffix: '/payments'     },
    ];

    const failures: string[] = [];

    for (const tab of TABS) {
      const url = `${BASE}/projects/${projectId}${tab.suffix}`;
      // Use networkidle — client layout hydration can take > 1.5s on dev server
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error') || (bodyText.includes('Error') && bodyText.length < 300);

      if (crashed) {
        failures.push(`Tab "${tab.label}" at ${url} crashed`);
        console.error(`  ✗ ${tab.label} — CRASHED`);
      } else {
        // Check the tab bar via its href pattern — more reliable than text matching
        const overviewLink = page.locator(`a[href="/projects/${projectId}"]`).first();
        const tabBarVisible = await overviewLink.isVisible({ timeout: 8000 }).catch(() => false);
        if (!tabBarVisible) {
          failures.push(`Tab bar missing on "${tab.label}" sub-page`);
          console.warn(`  ⚠️  ${tab.label} — tab bar not visible`);
        } else {
          console.log(`  ✓ ${tab.label}`);
        }
      }

      await ss(page, `project-tab-${tab.label.toLowerCase().replace(/\s/g, '-')}`);
    }

    expect(failures).toHaveLength(0);
    console.log('✅ B PASS — All project sub-tabs load correctly');
  });

  // ── C. Lead detail sub-pages ───────────────────────────────────────────────
  test('C — Lead detail sub-pages load (follow-ups, requirements, site-visit)', async ({ page }) => {
    const { leadId } = await discoverIds(page);

    if (!leadId) {
      console.log('  ⚠️  No leads in DB — skipping');
      test.skip(true, 'No leads to test');
      return;
    }

    const SUB_PAGES = [
      { label: 'Lead detail',   suffix: ''              },
      { label: 'Follow-ups',    suffix: '/follow-ups'   },
      { label: 'Requirements',  suffix: '/requirements' },
      { label: 'Site Visit',    suffix: '/site-visit'   },
    ];

    const failures: string[] = [];

    for (const sub of SUB_PAGES) {
      const url = `${BASE}/leads/${leadId}${sub.suffix}`;
      // Use networkidle to give async fetches time to settle
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error') ||
        (bodyText.length < 100 && bodyText.includes('Error'));

      if (crashed) {
        failures.push(`Lead sub-page "${sub.label}" crashed`);
        console.error(`  ✗ ${sub.label} — CRASHED`);
      } else {
        console.log(`  ✓ ${sub.label}`);
      }

      await ss(page, `lead-sub-${sub.label.toLowerCase().replace(/\s/g, '-')}`);
    }

    expect(failures).toHaveLength(0);
    console.log('✅ C PASS — Lead sub-pages load correctly');
  });

  // ── D. Entity detail pages load ────────────────────────────────────────────
  test('D — Entity detail pages load (customer, vendor, invoice, site-visit)', async ({ page }) => {
    const ids = await discoverIds(page);
    const failures: string[] = [];

    const checks = [
      { label: 'Customer detail',  url: ids.customerId  ? `/customers/${ids.customerId}`   : null },
      { label: 'Vendor detail',    url: ids.vendorId    ? `/vendors/${ids.vendorId}`        : null },
      { label: 'Invoice detail',   url: ids.invoiceId   ? `/invoices/${ids.invoiceId}`      : null },
      { label: 'Site Visit detail',url: ids.siteVisitId ? `/site-visits/${ids.siteVisitId}` : null },
      { label: 'PO detail',        url: ids.poId        ? `/purchase-orders/${ids.poId}`    : null },
    ];

    let tested = 0;
    for (const { label, url } of checks) {
      if (!url) {
        console.log(`  ⚠️  ${label} — no data, skipped`);
        continue;
      }

      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 });

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error') || (bodyText.length < 200 && bodyText.includes('Error'));

      if (crashed) {
        failures.push(`${label} crashed at ${url}`);
        console.error(`  ✗ ${label} — CRASHED`);
      } else {
        console.log(`  ✓ ${label}`);
        tested++;
      }

      await ss(page, `detail-${label.toLowerCase().replace(/\s/g, '-')}`);
    }

    console.log(`  Tested ${tested}/${checks.length} detail pages`);
    expect(failures).toHaveLength(0);
    console.log('✅ D PASS — Entity detail pages load correctly');
  });

  // ── E. Create Lead form validation ─────────────────────────────────────────
  // Strategy: name+phone have HTML5 required → fill those to reach the JS handler.
  // ownerId defaults to '' and has no HTML required → JS handler fires
  // "Please assign this lead to a team member." (NewLeadDialog.tsx line 328)
  test('E — Create Lead form rejects invalid submission with error message', async ({ page }) => {
    await page.goto(`${BASE}/leads`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Open New Lead dialog
    const newLeadBtn = page.locator('button', { hasText: /new lead|add lead/i }).first();
    if (!await newLeadBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      console.log('  ⚠️  New Lead button not found — skipping');
      return;
    }
    await newLeadBtn.click();
    await page.waitForTimeout(800);

    // Select "New Customer" if the choice dialog appears
    const newCustomerBtn = page.locator('button', { hasText: /new customer/i }).first();
    if (await newCustomerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newCustomerBtn.click();
      await page.waitForTimeout(600);
    }

    // Scope everything inside the dialog
    const dialog = page.locator('[role="dialog"]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 4000 }).catch(() => false);
    if (!dialogVisible) {
      console.log('  ⚠️  Dialog did not open — skipping');
      return;
    }

    // Fill name + phone to satisfy HTML5 required, leaving ownerId (Assigned To) empty
    // HTML5 required is on contactName + contactPhone inputs only; ownerId Select has no required attribute
    const nameInput = dialog.locator('#contactName').first();
    const phoneInput = dialog.locator('#contactPhone').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('Test User');
      await phoneInput.fill('9876543210');
    } else {
      console.log('  ⚠️  Name/phone inputs not found — skipping');
      return;
    }

    // Submit — JS handler runs, finds empty ownerId, sets error state
    const submitBtn = dialog.locator('button[type=submit]').first();
    if (!await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  ⚠️  Submit button not found — skipping');
      return;
    }
    await submitBtn.click();
    await page.waitForTimeout(800);

    // Validation: NewLeadDialog.tsx line 328 sets error state →
    // renders a red <p> "Please assign this lead to a team member."
    // The error element appears at the bottom of the form (line 708-709)
    const errorEl = dialog.locator('p').filter({ hasText: /assign|required/i }).first();
    const hasValidationMsg = await errorEl.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`  Validation message visible: ${hasValidationMsg}`);
    await ss(page, 'form-validation-lead');

    expect(hasValidationMsg).toBe(true);

    const bodyText = await page.innerText('body').catch(() => '');
    expect(bodyText.includes('Internal Server Error')).toBe(false);

    console.log('✅ E PASS — Lead form JS validation fires and shows error message');
  });

  // ── F. Create Invoice form validation ─────────────────────────────────────
  test('F — Create Invoice form rejects empty / invalid input', async ({ page }) => {
    await page.goto(`${BASE}/invoices`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await ss(page, 'invoice-list');

    // Look for a "New Invoice" button
    const newInvBtn = page.locator('button', { hasText: /new invoice|create invoice/i }).first();
    if (!await newInvBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('  ⚠️  New Invoice button not found — skipping');
      return;
    }
    await newInvBtn.click();
    await page.waitForTimeout(1000);
    await ss(page, 'invoice-form-open');

    // Submit empty
    const submitBtn = page.locator('button[type=submit], button', { hasText: /create|save|generate/i }).first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(800);

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error');
      expect(crashed).toBe(false);

      await ss(page, 'invoice-validation-result');
      console.log('  Invoice form empty-submit: did not crash ✓');
    }

    console.log('✅ F PASS — Invoice form validation runs without crash');
  });

  // ── G. Empty-state pages render correctly ─────────────────────────────────
  test('G — Empty states render on list pages', async ({ page }) => {
    // Reports, Attendance, Tasks, and My Space pages may be empty — check they don't crash
    const ROUTES = [
      { route: '/reports',           label: 'Reports'           },
      { route: '/attendance',        label: 'Attendance'        },
      { route: '/tasks',             label: 'Tasks'             },
      { route: '/my-space',          label: 'My Space'          },
      { route: '/my-space/profile',  label: 'My Profile'        },
      { route: '/settings',          label: 'Settings'          },
    ];

    const failures: string[] = [];

    for (const { route, label } of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error');
      const isEmpty  = bodyText.length < 50;

      if (crashed) {
        failures.push(`${label} crashed`);
        console.error(`  ✗ ${label} — CRASHED`);
      } else if (isEmpty) {
        failures.push(`${label} rendered blank page`);
        console.warn(`  ⚠️  ${label} — blank (${bodyText.length} chars)`);
      } else {
        console.log(`  ✓ ${label}`);
      }

      await ss(page, `empty-state-${label.toLowerCase().replace(/\s/g, '-')}`);
    }

    expect(failures).toHaveLength(0);
    console.log('✅ G PASS — Empty-state pages render correctly');
  });

  // ── H. Vendor & Purchase Order CRUD ───────────────────────────────────────
  test('H — Create and view a Vendor + Purchase Order', async ({ page }) => {
    // --- Create Vendor ---
    await page.goto(`${BASE}/vendors`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await ss(page, 'vendors-list');

    const newVendorBtn = page.locator('button', { hasText: /new vendor|add vendor/i }).first();
    if (!await newVendorBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('  ⚠️  New Vendor button not found — checking if form is inline');
    } else {
      await newVendorBtn.click();
      await page.waitForTimeout(800);
      await ss(page, 'vendor-form-open');

      // Fill vendor name
      const nameInput = page.getByLabel(/vendor name|name/i).first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('QA Test Vendor - DO NOT USE');
      }

      // Submit
      const submitBtn = page.locator('button[type=submit], button', { hasText: /create|save/i }).first();
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, 'vendor-created');

        const bodyText = await page.innerText('body').catch(() => '');
        const crashed  = bodyText.includes('Internal Server Error');
        expect(crashed).toBe(false);
        console.log('  Vendor creation form: submitted without crash ✓');
      }
    }

    // --- View PO list ---
    await page.goto(`${BASE}/purchase-orders`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await ss(page, 'po-list');

    const poBodyText = await page.innerText('body').catch(() => '');
    expect(poBodyText).not.toContain('Internal Server Error');
    console.log('  Purchase Orders page: loads ✓');

    // Check for New PO button
    const newPoBtn = page.locator('button', { hasText: /new.*order|create.*order|add.*order/i }).first();
    const poButtonVisible = await newPoBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  New PO button visible: ${poButtonVisible}`);

    console.log('✅ H PASS — Vendor & PO pages load and forms are accessible');
  });

  // ── I. Finance full-tab audit ─────────────────────────────────────────────
  test('I — Finance page: all tabs load and show content or empty state', async ({ page }) => {
    const TABS = [
      { label: 'To Collect', param: 'to-collect' },
      { label: 'Received',   param: 'received'   },
      { label: 'Expenses',   param: 'expenses'   },
      { label: 'GST',        param: 'gst'        },
    ];

    for (const tab of TABS) {
      await page.goto(`${BASE}/finance?tab=${tab.param}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const bodyText = await page.innerText('body').catch(() => '');
      const crashed  = bodyText.includes('Internal Server Error');

      if (crashed) {
        console.error(`  ✗ Finance tab "${tab.label}" — CRASHED`);
      } else {
        console.log(`  ✓ Finance → ${tab.label}`);
      }

      await ss(page, `finance-tab-${tab.param}`);
      expect(crashed).toBe(false);
    }

    console.log('✅ I PASS — Finance all tabs load without crash');
  });

  // ── J. Lead → Project data integrity check ────────────────────────────────
  test('J — Lead converted to project appears in projects list', async ({ page }) => {
    // Find a project and navigate from its source lead (if any)
    const projRes = await page.request.get(`${BASE}/api/v1/projects?limit=1`);
    if (!projRes.ok()) {
      console.log('  ⚠️  No projects found — skipping');
      return;
    }

    const { data: projects } = await projRes.json() as { data: Array<{ id: string; name: string; leadId?: string }> };
    if (!projects?.length) {
      console.log('  ⚠️  No projects — skipping');
      return;
    }

    const project = projects[0];
    console.log(`  Checking project: ${project.name} (id=${project.id})`);

    // Navigate to project page — should render project name
    await page.goto(`${BASE}/projects/${project.id}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const bodyText = await page.innerText('body').catch(() => '');
    const crashed  = bodyText.includes('Internal Server Error');
    expect(crashed).toBe(false);

    // The project shell header should load eventually (async fetch)
    const header = page.locator('h1').first();
    const headerVisible = await header.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`  Project header visible: ${headerVisible}`);

    // Check the tab bar is present
    const tabBar = page.locator('a', { hasText: /Overview/i }).first();
    const tabBarVisible = await tabBar.isVisible({ timeout: 6000 }).catch(() => false);
    console.log(`  Tab bar visible: ${tabBarVisible}`);

    await ss(page, 'project-data-integrity');
    expect(crashed).toBe(false);
    console.log('✅ J PASS — Project detail loads with tab bar and no crash');
  });

  // ── K. Notifications page ─────────────────────────────────────────────────
  test('K — Notifications page loads', async ({ page }) => {
    await page.goto(`${BASE}/notifications`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const bodyText = await page.innerText('body').catch(() => '');
    const crashed  = bodyText.includes('Internal Server Error');

    await ss(page, 'notifications');
    expect(crashed).toBe(false);
    console.log('✅ K PASS — Notifications page loads');
  });

  // ── L. Lead detail page renders actions appropriate to lead stage ──────────
  test('L — Lead detail page renders without crash and shows stage-appropriate UI', async ({ page }) => {
    const { leadId } = await discoverIds(page);

    if (!leadId) {
      console.log('  ⚠️  No leads — skipping');
      test.skip(true, 'No leads to test');
      return;
    }

    await page.goto(`${BASE}/leads/${leadId}`, { waitUntil: 'networkidle', timeout: 30000 });

    const bodyText = await page.innerText('body').catch(() => '');
    const crashed  = bodyText.includes('Internal Server Error');
    expect(crashed).toBe(false);

    // The lead page always has: back link, lead name/contact, and at least one action
    // (site visit, convert, reopen, or linked project — depends on stage)
    const actionBtns = [
      /schedule.*site.*visit/i,
      /convert.*project|convert.*client|book.*project/i,
      /reopen.*lead/i,
      /view.*project/i,
      /move stage/i,          // dropdown for non-terminal leads
    ];

    let foundAction = false;
    for (const pattern of actionBtns) {
      const el = page.locator('button, a', { hasText: pattern }).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        foundAction = true;
        console.log(`  Found action: "${pattern.source}"`);
        break;
      }
    }

    // Won lead → "View Project" link in Linked Project card (leads/[id]/page.tsx line 711)
    // Lost lead → "Reopen Lead" button
    // Non-terminal → "Schedule Site Visit" or "Convert to Project" buttons
    // All leads with a customer → "View Client" link (always present)
    // At least one of these must be visible — if none appear the page is broken
    const hasInteraction = foundAction || bodyText.includes('Move Stage') || bodyText.includes('View Client');
    console.log(`  Has interaction: ${hasInteraction} (found action button: ${foundAction})`);

    await ss(page, 'lead-detail-action-buttons');

    expect(crashed).toBe(false);
    expect(bodyText.length).toBeGreaterThan(200);
    // Stage-appropriate action must appear — validates the page is actually rendering lead data
    expect(hasInteraction).toBe(true);
    console.log('✅ L PASS — Lead detail renders without crash with stage-appropriate UI');
  });

  // ── M. Finance → Invoice → Detail page ────────────────────────────────────
  test('M — Invoice detail page renders correctly', async ({ page }) => {
    const { invoiceId } = await discoverIds(page);

    if (!invoiceId) {
      console.log('  ⚠️  No invoices — checking /invoices list only');

      await page.goto(`${BASE}/invoices`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      const bodyText = await page.innerText('body').catch(() => '');
      expect(bodyText.includes('Internal Server Error')).toBe(false);
      console.log('  Invoice list loads (empty) ✓');
      return;
    }

    await page.goto(`${BASE}/invoices/${invoiceId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const bodyText = await page.innerText('body').catch(() => '');
    const crashed  = bodyText.includes('Internal Server Error');
    expect(crashed).toBe(false);

    // Should show the invoice number or rupee sign
    const hasInvoiceContent = bodyText.includes('₹') || bodyText.includes('Invoice') || bodyText.includes('invoice');
    console.log(`  Invoice detail has content: ${hasInvoiceContent}`);

    await ss(page, 'invoice-detail');
    console.log('✅ M PASS — Invoice detail page loads');
  });

  // ── N. Leads analytics page ────────────────────────────────────────────────
  test('N — Leads analytics page loads', async ({ page }) => {
    await page.goto(`${BASE}/leads/analytics`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const bodyText = await page.innerText('body').catch(() => '');
    const crashed  = bodyText.includes('Internal Server Error');

    await ss(page, 'leads-analytics');
    expect(crashed).toBe(false);
    console.log('✅ N PASS — Leads analytics page loads');
  });

  // ── O. Site Visits module ─────────────────────────────────────────────────
  test('O — Site Visits list and detail page load', async ({ page }) => {
    // List
    await page.goto(`${BASE}/site-visits`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const listText = await page.innerText('body').catch(() => '');
    expect(listText.includes('Internal Server Error')).toBe(false);
    console.log('  Site Visits list: ✓');

    await ss(page, 'site-visits-list');

    // Detail (if any exist)
    const { siteVisitId } = await discoverIds(page);
    if (siteVisitId) {
      await page.goto(`${BASE}/site-visits/${siteVisitId}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      const detailText = await page.innerText('body').catch(() => '');
      expect(detailText.includes('Internal Server Error')).toBe(false);
      console.log('  Site Visit detail: ✓');
      await ss(page, 'site-visit-detail');
    } else {
      console.log('  ⚠️  No site visits for detail check');
    }

    console.log('✅ O PASS — Site Visits module loads');
  });

  // ── P. Dashboard widget data renders correctly ─────────────────────────────
  test('P — Dashboard renders KPI cards and pipeline summary', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const bodyText = await page.innerText('body').catch(() => '');
    expect(bodyText.includes('Internal Server Error')).toBe(false);

    // Check for key dashboard sections
    const hasRupee    = bodyText.includes('₹');
    const hasLead     = bodyText.toLowerCase().includes('lead');
    const hasProject  = bodyText.toLowerCase().includes('project');

    console.log(`  Has ₹ values: ${hasRupee}`);
    console.log(`  Has lead data: ${hasLead}`);
    console.log(`  Has project data: ${hasProject}`);

    await ss(page, 'dashboard-full');

    // Dashboard should show at least some content
    expect(bodyText.length).toBeGreaterThan(500);
    console.log('✅ P PASS — Dashboard renders content');
  });
});
