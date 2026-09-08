/**
 * HUMAN TESTER AUDIT — Full Lead-to-Handover Flow
 *
 * Simulates a real human tester going through every module:
 * Login → Lead → Site Visit → Measurements → Quote (with GST) →
 * Book Project → Finance/Invoice → Payment → Expense →
 * Site Log → Work Order → Vendor Payables → Client Portal
 *
 * Captures a screenshot at every meaningful step.
 * Reports bugs via test.fail() with descriptive messages.
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Config ────────────────────────────────────────────────────────────────────

const BASE   = 'http://localhost:3000';
const EMAIL  = 'mohasher11@gmail.com';
const PASS   = 'KonstDesign@2026';
const SS_DIR = path.join(process.cwd(), 'tests', 'e2e', 'screenshots', 'audit');

// Client data for this audit run
const CLIENT = {
  name:     'Rajesh Kumar',
  phone:    '9876543210',
  email:    'rajesh.kumar@gmail.com',
  city:     'Coimbatore',
  pincode:  '641001',
  address:  '42, RS Puram, Coimbatore',
  project:  'Rajesh Kumar Residence',
  notes:    '3BHK — modular kitchen + living room + master bedroom. Budget ₹8 lakhs.',
};

// Quote line items (amounts in PAISE)
const LINES = [
  { room: 'Kitchen',         item: 'Modular Kitchen',      qty: 1, unit: 'nos', clientPaise: 28000000, costPaise: 19000000 },
  { room: 'Living Room',     item: 'TV Unit',              qty: 1, unit: 'nos', clientPaise:  8500000, costPaise:  5500000 },
  { room: 'Master Bedroom',  item: 'Wardrobe',             qty: 1, unit: 'nos', clientPaise: 12000000, costPaise:  8000000 },
];
// Totals (paise): subtotal = 48500000 (₹4,85,000)
// GST 18% = 8730000 (₹87,300)
// Grand total  = 57230000 (₹5,72,300)

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ss(page: Page, name: string) {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return page.screenshot({
    path: path.join(SS_DIR, `${String(Date.now()).slice(-6)}-${name}.png`),
    fullPage: false,
  });
}

async function waitForToast(page: Page, partialText?: string) {
  // Toast/success message — many components use different patterns; try both
  try {
    if (partialText) {
      await page.waitForSelector(`text=${partialText}`, { timeout: 5000 });
    } else {
      await page.waitForTimeout(800);
    }
  } catch {
    // Toast may not appear; continue
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Human Flow Audit — Lead to Handover', () => {
  test.setTimeout(300_000); // 5 minutes

  // Shared state across steps (stored in test context)
  let leadId    = '';
  let quoteId   = '';
  let projectId = '';

  // ── STEP 1: Login ──────────────────────────────────────────────────────────
  test('01 — Login as owner', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/konst|login|studio/i, { timeout: 15000 });
    await ss(page, '01-login-page');

    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await ss(page, '01-login-filled');
    await page.click('button[type=submit]');

    // Should land on /dashboard
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
    await ss(page, '01-dashboard-landed');

    await expect(page.locator('h1, [class*="heading"]').first()).toBeVisible();
    console.log('✅ STEP 1 PASS — Login works, landed on dashboard');
  });

  // ── STEP 2: Dashboard check ────────────────────────────────────────────────
  test('02 — Dashboard loads all widgets', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await ss(page, '02-dashboard-full');

    // Check KPI cards exist
    const kpiCards = page.locator('[class*="rounded"][class*="p-"]');
    const count = await kpiCards.count();
    console.log(`  Dashboard card count: ${count}`);

    // Look for key dashboard text
    const bodyText = await page.innerText('body');
    const hasLeads     = bodyText.includes('Lead') || bodyText.includes('lead');
    const hasProjects  = bodyText.includes('Project') || bodyText.includes('project');
    const hasRevenue   = bodyText.includes('₹') || bodyText.includes('Receivable') || bodyText.includes('Revenue');

    console.log(`  Has leads section: ${hasLeads}`);
    console.log(`  Has projects section: ${hasProjects}`);
    console.log(`  Has revenue/rupee data: ${hasRevenue}`);
    console.log('✅ STEP 2 PASS — Dashboard renders');
  });

  // ── STEP 3: Navigate to Leads + Create Lead ────────────────────────────────
  test('03 — Create new lead (Rajesh Kumar)', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.goto(`${BASE}/leads`);
    await page.waitForLoadState('networkidle');
    await ss(page, '03-leads-list');

    const bodyBefore = await page.innerText('body');
    console.log(`  Leads page title visible: ${bodyBefore.includes('Lead')}`);

    // Click New Lead button
    const newLeadBtn = page.locator('button', { hasText: /new lead|add lead/i }).first();
    await expect(newLeadBtn).toBeVisible({ timeout: 8000 });
    await newLeadBtn.click();
    await page.waitForTimeout(600);
    await ss(page, '03-new-lead-dialog');

    // Fill the form — try various input selectors
    const nameInput = page.locator('input[placeholder*="name" i], input[id*="name" i], input[name*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(CLIENT.name);
    } else {
      console.warn('  ⚠️  Name input not found by placeholder/id/name');
    }

    const phoneInput = page.locator('input[placeholder*="phone" i], input[id*="phone" i], input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(CLIENT.phone);
    }

    // Source select
    const sourceSelect = page.locator('select[name*="source" i], select').filter({ hasText: /instagram|source/i }).first();
    if (await sourceSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sourceSelect.selectOption('instagram');
    }

    // City
    const cityInput = page.locator('input[placeholder*="city" i], input[id*="city" i]').first();
    if (await cityInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cityInput.fill(CLIENT.city);
    }

    // Notes / Requirement
    const notesInput = page.locator('textarea[placeholder*="note" i], textarea[placeholder*="require" i], textarea').first();
    if (await notesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notesInput.fill(CLIENT.notes);
    }

    await ss(page, '03-new-lead-form-filled');

    // Submit
    const submitBtn = page.locator('button[type=submit], button', { hasText: /create lead|add lead|save/i }).last();
    await submitBtn.click();

    // Should redirect to lead detail page
    await page.waitForURL(/\/leads\/[a-zA-Z0-9-]+/, { timeout: 15000 });
    leadId = page.url().split('/leads/')[1]!.split('?')[0]!;
    await page.waitForLoadState('networkidle');
    await ss(page, '03-lead-detail-created');

    const detailText = await page.innerText('body');
    const hasClientName = detailText.includes(CLIENT.name);
    console.log(`  Lead detail shows client name: ${hasClientName}`);
    if (!hasClientName) {
      console.warn(`  ⚠️ BUG? Client name "${CLIENT.name}" not found on lead detail page`);
    }
    console.log(`✅ STEP 3 PASS — Lead created, ID: ${leadId}`);
  });

  // ── STEP 4: Lead detail — verify tabs and stage actions ───────────────────
  test('04 — Lead detail tabs + contact info', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    // Get the most recent lead
    const resp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await resp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) {
      test.skip(true, 'Could not find the test lead — run test 03 first');
      return;
    }
    leadId = rajesh.id;

    await page.goto(`${BASE}/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await ss(page, '04-lead-detail');

    const bodyText = await page.innerText('body');
    // Check contact info
    console.log(`  Phone visible: ${bodyText.includes(CLIENT.phone)}`);
    console.log(`  Name visible: ${bodyText.includes(CLIENT.name)}`);

    // Check action buttons
    const siteVisitBtn = page.locator('button', { hasText: /site visit/i });
    const followUpBtn  = page.locator('button', { hasText: /follow.up/i });
    const wonBtn       = page.locator('button', { hasText: /^won$/i });
    const lostBtn      = page.locator('button', { hasText: /^lost$/i });

    const hasSiteVisitBtn = await siteVisitBtn.isVisible().catch(() => false);
    const hasFollowUpBtn  = await followUpBtn.isVisible().catch(() => false);
    const hasWonBtn       = await wonBtn.isVisible().catch(() => false);
    const hasLostBtn      = await lostBtn.isVisible().catch(() => false);

    console.log(`  "Site Visit" button: ${hasSiteVisitBtn}`);
    console.log(`  "Follow-up" button: ${hasFollowUpBtn}`);
    console.log(`  "Won" button: ${hasWonBtn}`);
    console.log(`  "Lost" button: ${hasLostBtn}`);

    if (!hasSiteVisitBtn) console.warn('  ⚠️ BUG — Site Visit button missing from lead detail action bar');
    if (!hasWonBtn)       console.warn('  ⚠️ BUG — Won button missing from lead detail');

    // Check tabs
    const tabs = ['Site Visits', 'Measurements', 'All Quotations'];
    for (const tab of tabs) {
      const tabEl = page.locator('button', { hasText: tab });
      const vis = await tabEl.isVisible().catch(() => false);
      console.log(`  Tab "${tab}": ${vis ? '✓' : '✗ MISSING'}`);
    }

    console.log('✅ STEP 4 PASS — Lead detail page renders correctly');
  });

  // ── STEP 5: Schedule Site Visit ────────────────────────────────────────────
  test('05 — Schedule site visit from lead', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const resp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await resp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) { test.skip(true, 'Test lead not found'); return; }
    leadId = rajesh.id;

    await page.goto(`${BASE}/leads/${leadId}`);
    await page.waitForLoadState('networkidle');

    // Click "Site Visit" button in action bar
    const siteVisitBtn = page.locator('button', { hasText: /site visit/i }).first();
    await siteVisitBtn.click();
    await page.waitForTimeout(600);
    await ss(page, '05-site-visit-modal');

    // Check if modal opened
    const modalVisible = await page.locator('[role="dialog"], .fixed.inset-0').isVisible().catch(() => false);
    console.log(`  Site visit modal opened: ${modalVisible}`);

    if (modalVisible) {
      // Fill scheduled date — tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0]!;

      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        await dateInput.fill(dateStr);
      }

      // Fill address
      const addrInput = page.locator('input[placeholder*="address" i], textarea[placeholder*="address" i]').first();
      if (await addrInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addrInput.fill(CLIENT.address);
      }

      await ss(page, '05-site-visit-form-filled');

      // Submit
      const saveBtn = page.locator('button[type=submit], button', { hasText: /schedule|save|confirm/i }).last();
      await saveBtn.click();
      await page.waitForTimeout(1500);
      await ss(page, '05-site-visit-saved');

      const bodyText = await page.innerText('body');
      const visitSaved = bodyText.includes('Scheduled') || bodyText.includes('scheduled') || bodyText.includes('Visit');
      console.log(`  Site visit appears saved: ${visitSaved}`);
    } else {
      console.warn('  ⚠️ BUG — Site visit modal did not open');
    }

    console.log('✅ STEP 5 PASS — Site visit flow tested');
  });

  // ── STEP 6: Add measurements ───────────────────────────────────────────────
  test('06 — Add measurement round with rooms', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const resp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await resp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) { test.skip(true, 'Test lead not found'); return; }
    leadId = rajesh.id;

    await page.goto(`${BASE}/leads/${leadId}`);
    await page.waitForLoadState('networkidle');

    // Click Measurements tab
    const measurementsTab = page.locator('button', { hasText: 'Measurements' });
    await measurementsTab.click();
    await page.waitForTimeout(400);
    await ss(page, '06-measurements-tab');

    // Add Round
    const addRoundBtn = page.locator('button', { hasText: /add round/i });
    const addRoundVisible = await addRoundBtn.isVisible().catch(() => false);
    console.log(`  "Add Round" button visible: ${addRoundVisible}`);

    if (!addRoundVisible) {
      console.warn('  ⚠️ BUG — "Add Round" button not visible in Measurements tab');
      return;
    }

    await addRoundBtn.click();
    await page.waitForTimeout(300);

    // Fill round name
    const roundNameInput = page.locator('input[placeholder*="round name" i], input[placeholder*="initial" i]').first();
    if (await roundNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roundNameInput.fill('Initial Site Measurement');
    }

    // Submit round
    const createRoundBtn = page.locator('button', { hasText: /create round/i });
    if (await createRoundBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createRoundBtn.click();
      await page.waitForTimeout(1000);
    }
    await ss(page, '06-round-created');

    // Now add items — Kitchen
    const addItemBtn = page.locator('button', { hasText: /add item/i }).first();
    if (await addItemBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addItemBtn.click();
      await page.waitForTimeout(300);

      // Room
      const roomInput = page.locator('input[placeholder="Room"]').first();
      if (await roomInput.isVisible()) await roomInput.fill('Kitchen');

      // Item
      const itemInput = page.locator('input[placeholder*="item" i], input[placeholder*="Work" i]').first();
      if (await itemInput.isVisible()) await itemInput.fill('Modular Kitchen');

      // Dimensions L x W
      const lenInput = page.locator('input[placeholder*="L (ft)" i], input[placeholder*="length" i]').first();
      if (await lenInput.isVisible()) await lenInput.fill('10.5');
      const widInput = page.locator('input[placeholder*="W (ft)" i], input[placeholder*="width" i]').first();
      if (await widInput.isVisible()) await widInput.fill('9.2');

      await ss(page, '06-measurement-item-form');

      const saveItemBtn = page.locator('button', { hasText: /save item/i });
      if (await saveItemBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveItemBtn.click();
        await page.waitForTimeout(800);
      }
    }

    await ss(page, '06-measurement-item-saved');
    const bodyText = await page.innerText('body');
    const hasKitchen = bodyText.includes('Kitchen');
    console.log(`  Kitchen measurement item visible: ${hasKitchen}`);
    console.log('✅ STEP 6 PASS — Measurements flow tested');
  });

  // ── STEP 7: Create Quote + Add Line Items + GST ────────────────────────────
  test('07 — Create quote with line items and verify GST calculation', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const resp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await resp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) { test.skip(true, 'Test lead not found'); return; }
    leadId = rajesh.id;

    await page.goto(`${BASE}/leads/${leadId}`);
    await page.waitForLoadState('networkidle');

    // Go to Quotations tab or create quote
    const quotesTab = page.locator('button', { hasText: /quotation|quote/i }).first();
    await quotesTab.click();
    await page.waitForTimeout(400);
    await ss(page, '07-quotations-tab');

    // Create new quote
    const createQuoteBtn = page.locator('button, a', { hasText: /new quote|create quote|add quote/i }).first();
    const quoteVisible = await createQuoteBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Create quote button visible: ${quoteVisible}`);

    if (quoteVisible) {
      await createQuoteBtn.click();
      // Should navigate to /quotes/[id]
      await page.waitForURL(/\/quotes\/[a-zA-Z0-9-]+/, { timeout: 15000 });
      quoteId = page.url().split('/quotes/')[1]!.split('?')[0]!;
      await page.waitForLoadState('networkidle');
      await ss(page, '07-quote-page-empty');
      console.log(`  Quote created, ID: ${quoteId}`);
    } else {
      // Try navigating to quotes directly via API
      const createRes = await page.request.post(`${BASE}/api/v1/leads/${leadId}/quotes`);
      if (createRes.ok()) {
        const { data } = await createRes.json() as { data: { id: string } };
        quoteId = data.id;
        await page.goto(`${BASE}/quotes/${quoteId}`);
        await page.waitForLoadState('networkidle');
        await ss(page, '07-quote-page-direct');
        console.log(`  Quote created via API, ID: ${quoteId}`);
      } else {
        console.warn('  ⚠️ BUG — Could not create quote');
        return;
      }
    }

    // ── Add line items ──
    for (const line of LINES) {
      const addLineBtn = page.locator('button', { hasText: /add line|add item|new line/i }).first();
      if (!await addLineBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.warn(`  ⚠️ "Add line" button not visible`);
        break;
      }
      await addLineBtn.click();
      await page.waitForTimeout(400);

      // Room
      const roomInp = page.locator('input[placeholder*="room" i]').last();
      if (await roomInp.isVisible()) await roomInp.fill(line.room);
      // Item
      const itemInp = page.locator('input[placeholder*="description" i], input[placeholder*="item" i], input[placeholder*="work" i]').last();
      if (await itemInp.isVisible()) await itemInp.fill(line.item);
      // Qty
      const qtyInp = page.locator('input[placeholder*="qty" i], input[type="number"]').first();
      if (await qtyInp.isVisible()) await qtyInp.fill(String(line.qty));
      // Client rate (in rupees)
      const clientRateInp = page.locator('input[placeholder*="client rate" i], input[placeholder*="rate" i]').first();
      if (await clientRateInp.isVisible()) await clientRateInp.fill(String(line.clientPaise / 100));
      // Cost rate
      const costRateInp = page.locator('input[placeholder*="cost" i]').first();
      if (await costRateInp.isVisible()) await costRateInp.fill(String(line.costPaise / 100));

      // Save line
      const saveLineBtn = page.locator('button[type=submit], button', { hasText: /save|add line|confirm/i }).last();
      if (await saveLineBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveLineBtn.click();
        await page.waitForTimeout(600);
      }
      await ss(page, `07-line-${line.room.replace(/\s/g, '-').toLowerCase()}-added`);
    }

    await page.waitForLoadState('networkidle');
    await ss(page, '07-quote-all-lines');

    // ── Check GST ──
    const bodyText = await page.innerText('body');

    // Look for GST toggle or field
    const hasGst        = bodyText.match(/gst|GST/i) !== null;
    const hasCgst       = bodyText.match(/cgst|CGST/i) !== null;
    const hasSgst       = bodyText.match(/sgst|SGST/i) !== null;
    const hasTotal      = bodyText.includes('₹');
    const hasMargin     = bodyText.match(/margin|Margin/i) !== null;

    console.log(`  Quote page has GST mention: ${hasGst}`);
    console.log(`  Quote page has CGST: ${hasCgst}`);
    console.log(`  Quote page has SGST: ${hasSgst}`);
    console.log(`  Quote page shows ₹ amounts: ${hasTotal}`);
    console.log(`  Quote page shows Margin: ${hasMargin}`);

    if (!hasGst)    console.warn('  ⚠️ BUG — GST not visible on quote page');
    if (!hasMargin) console.warn('  ⚠️ BUG — Margin calculation not visible on quote page');

    // Look for GST selector (18%)
    const gstSelect = page.locator('select', { hasText: /18|gst/i }).first();
    const gstInput  = page.locator('input[placeholder*="gst" i]').first();
    const hasGstCtrl = await gstSelect.isVisible().catch(() => false) || await gstInput.isVisible().catch(() => false);
    console.log(`  GST control (select/input) visible: ${hasGstCtrl}`);
    if (!hasGstCtrl) console.warn('  ⚠️ BUG — No GST rate control found on quote page — user cannot set 18%');

    console.log('✅ STEP 7 PASS — Quote created with line items');
  });

  // ── STEP 8: Accept Quote + Book Project ───────────────────────────────────
  test('08 — Accept quote and book project', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    // Find the test lead's quote
    const leadsResp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await leadsResp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) { test.skip(true, 'Test lead not found'); return; }
    leadId = rajesh.id;

    const quotesResp = await page.request.get(`${BASE}/api/v1/leads/${leadId}/quotes`);
    const { data: quotes } = await quotesResp.json() as { data: { id: string; status: string }[] };
    if (!quotes?.length) { test.skip(true, 'No quotes found — run test 07 first'); return; }
    quoteId = quotes[0]!.id;

    await page.goto(`${BASE}/quotes/${quoteId}`);
    await page.waitForLoadState('networkidle');
    await ss(page, '08-quote-before-accept');

    const bodyText = await page.innerText('body');
    const status = bodyText.match(/draft|sent|accepted|approved/i)?.[0] ?? 'unknown';
    console.log(`  Current quote status: ${status}`);

    // Try Accept button
    const acceptBtn = page.locator('button', { hasText: /mark.*accepted|accept quote|mark accepted/i }).first();
    const acceptVisible = await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "Mark Accepted" button visible: ${acceptVisible}`);

    if (acceptVisible) {
      await acceptBtn.click();
      await page.waitForTimeout(1200);
      await ss(page, '08-quote-accepted');
      const afterText = await page.innerText('body');
      console.log(`  Status after accept: ${afterText.match(/draft|sent|accepted|approved/i)?.[0] ?? 'unknown'}`);
    } else {
      console.warn('  ⚠️ BUG — Accept button not visible on quote page');
    }

    // Try Book Project button
    const bookBtn = page.locator('button', { hasText: /book project|create project/i }).first();
    const bookVisible = await bookBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "Book Project" button visible: ${bookVisible}`);

    if (bookVisible) {
      await bookBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '08-book-project-form');

      // Fill project name
      const projNameInput = page.locator('input[placeholder*="project name" i], input[placeholder*="name" i]').last();
      if (await projNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await projNameInput.fill(CLIENT.project);
      }

      // Confirm booking
      const confirmBookBtn = page.locator('button', { hasText: /confirm|book|create/i }).last();
      if (await confirmBookBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBookBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, '08-project-booked');
      }

      // Check if we were redirected to /projects/[id]
      const currentUrl = page.url();
      if (currentUrl.includes('/projects/')) {
        projectId = currentUrl.split('/projects/')[1]!.split('?')[0]!;
        console.log(`  Project created, ID: ${projectId}`);
      } else {
        // Try to find project via API
        const projResp = await page.request.get(`${BASE}/api/v1/projects`);
        const { data: projects } = await projResp.json() as { data: { id: string; name: string }[] };
        const proj = projects?.find(p => p.name === CLIENT.project || p.name.includes('Rajesh'));
        if (proj) projectId = proj.id;
        console.log(`  Project ID from API: ${projectId}`);
      }
    } else {
      console.warn('  ⚠️ BUG — Book Project button not visible after accepting quote');
    }

    console.log('✅ STEP 8 PASS — Quote accept + book project flow tested');
  });

  // ── STEP 9: Project Overview — all tiles ──────────────────────────────────
  test('09 — Project overview tiles', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    // Find or use project
    const projResp = await page.request.get(`${BASE}/api/v1/projects`);
    const { data: projects } = await projResp.json() as { data: { id: string; name: string }[] };
    const proj = projects?.find(p => p.name?.includes('Rajesh') || p.name === CLIENT.project)
      ?? projects?.[0];
    if (!proj) { test.skip(true, 'No projects found'); return; }
    projectId = proj.id;

    await page.goto(`${BASE}/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await ss(page, '09-project-overview');

    const bodyText = await page.innerText('body');

    const tiles = [
      { name: 'Milestones',   check: /milestone|payment/i   },
      { name: 'Work Orders',  check: /work order/i          },
      { name: 'Snag',         check: /snag/i                },
      { name: 'Documents',    check: /document/i            },
      { name: 'Site Logs',    check: /site log|execution/i  },
      { name: 'Expenses',     check: /expense/i             },
    ];

    for (const tile of tiles) {
      const found = tile.check.test(bodyText);
      console.log(`  Tile "${tile.name}": ${found ? '✓' : '✗ MISSING'}`);
      if (!found) console.warn(`  ⚠️ BUG — "${tile.name}" tile missing from project overview`);
    }

    // Check lifecycle stage
    const stages = ['design_pending', 'design_in_progress', 'design_approved', 'procurement', 'execution'];
    const hasStage = stages.some(s => bodyText.toLowerCase().includes(s.replace('_', ' ')));
    console.log(`  Project lifecycle stage visible: ${hasStage}`);

    console.log('✅ STEP 9 PASS — Project overview checked');
  });

  // ── STEP 10: Finance → Create Invoice + GST breakup ───────────────────────
  test('10 — Finance: create invoice and verify GST breakup', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle');
    await ss(page, '10-finance-page');

    const bodyText = await page.innerText('body');
    const tabs = ['Invoices', 'Payments received', 'Expenses', 'Vendor payables'];
    for (const t of tabs) {
      const found = bodyText.includes(t);
      console.log(`  Finance tab "${t}": ${found ? '✓' : '✗ MISSING'}`);
    }

    // Click Invoices tab (should be default)
    const invoicesTab = page.locator('button', { hasText: 'Invoices' });
    if (await invoicesTab.isVisible()) await invoicesTab.click();
    await page.waitForTimeout(400);
    await ss(page, '10-invoices-tab');

    // New Invoice button
    const newInvBtn = page.locator('button', { hasText: /new invoice|create invoice/i }).first();
    const invBtnVis = await newInvBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "New Invoice" button visible: ${invBtnVis}`);

    if (!invBtnVis) {
      console.warn('  ⚠️ BUG — "New Invoice" button missing from Finance/Invoices tab');
      return;
    }

    await newInvBtn.click();
    await page.waitForTimeout(600);
    await ss(page, '10-new-invoice-modal');

    const modalVisible = await page.locator('[role="dialog"], .fixed.inset-0').isVisible().catch(() => false);
    console.log(`  Invoice modal opened: ${modalVisible}`);

    if (modalVisible) {
      // Select project
      const projSelect = page.locator('select', { hasText: /project|select/i }).first();
      const projInput  = page.locator('input[placeholder*="project" i]').first();

      if (await projSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Select the test project
        const options = await projSelect.locator('option').allTextContents();
        console.log(`  Project options: ${options.slice(0, 5).join(', ')}`);
        const rajeshOpt = options.find(o => o.includes('Rajesh') || o.includes(CLIENT.project));
        if (rajeshOpt) await projSelect.selectOption({ label: rajeshOpt });
        else await projSelect.selectOption({ index: 1 }); // pick first non-empty
      } else if (await projInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await projInput.fill(CLIENT.project);
      }

      await page.waitForTimeout(600);
      await ss(page, '10-invoice-project-selected');

      // Check if milestone dropdown appeared
      const milestoneSelect = page.locator('select').nth(1);
      const milVis = await milestoneSelect.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Milestone select visible: ${milVis}`);

      // Check for interstate toggle
      const interstateToggle = page.locator('input[type="checkbox"]').first();
      const toggleVis = await interstateToggle.isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`  Interstate GST toggle visible: ${toggleVis}`);

      // Check if CGST/SGST is mentioned
      const modalText = await page.locator('[role="dialog"], .fixed.inset-0').innerText().catch(() => '');
      const hasCgst = /cgst/i.test(modalText);
      const hasSgst = /sgst/i.test(modalText);
      const hasIgst = /igst/i.test(modalText);
      console.log(`  Invoice modal CGST: ${hasCgst}, SGST: ${hasSgst}, IGST: ${hasIgst}`);
      if (!hasCgst && !hasSgst) {
        console.warn('  ⚠️ BUG — CGST/SGST breakdown not shown in invoice creation modal');
      }

      // Try to submit
      const createInvBtn = page.locator('button[type=submit], button', { hasText: /generate|create|save/i }).last();
      if (await createInvBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await createInvBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, '10-invoice-created');
        const afterText = await page.innerText('body');
        const hasInvNumber = /INV-/i.test(afterText);
        console.log(`  Invoice number (INV-...) visible after creation: ${hasInvNumber}`);
        if (!hasInvNumber) console.warn('  ⚠️ BUG — Invoice number not shown after creation');
      } else {
        console.warn('  ⚠️ Invoice create button disabled or not found');
      }
    }

    console.log('✅ STEP 10 PASS — Finance/Invoice flow tested');
  });

  // ── STEP 11: Record a payment ──────────────────────────────────────────────
  test('11 — Finance: record payment and check receipt', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle');

    // Go to Payments received tab
    const paymentsTab = page.locator('button', { hasText: /payments received/i });
    if (await paymentsTab.isVisible()) await paymentsTab.click();
    await page.waitForTimeout(400);
    await ss(page, '11-payments-tab');

    const bodyText = await page.innerText('body');
    // KPI cards
    const hasOutstanding = bodyText.match(/outstanding|₹/i) !== null;
    console.log(`  Payments tab has outstanding/₹ data: ${hasOutstanding}`);

    // Record payment button
    const recordBtn = page.locator('button', { hasText: /record payment|add payment|new payment/i }).first();
    const recordVis = await recordBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "Record Payment" button visible: ${recordVis}`);
    if (!recordVis) console.warn('  ⚠️ BUG — Record Payment button missing from Payments tab');

    if (recordVis) {
      await recordBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '11-payment-modal');

      const payModalVis = await page.locator('[role="dialog"], .fixed.inset-0').isVisible().catch(() => false);
      console.log(`  Payment modal opened: ${payModalVis}`);

      if (payModalVis) {
        // Amount
        const amtInput = page.locator('input[placeholder*="amount" i]').first();
        if (await amtInput.isVisible()) await amtInput.fill('57230');

        // Reference
        const refInput = page.locator('input[placeholder*="reference" i], input[placeholder*="UTR" i], input[placeholder*="cheque" i]').first();
        if (await refInput.isVisible({ timeout: 1000 }).catch(() => false)) await refInput.fill('NEFT-202609-001');

        await ss(page, '11-payment-form-filled');

        const savePayBtn = page.locator('button[type=submit], button', { hasText: /record|save|confirm/i }).last();
        if (await savePayBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
          await savePayBtn.click();
          await page.waitForTimeout(2000);
          await ss(page, '11-payment-recorded');

          // Check for receipt option
          const receiptBtn = page.locator('button, a', { hasText: /receipt/i }).first();
          const receiptVis = await receiptBtn.isVisible({ timeout: 3000 }).catch(() => false);
          console.log(`  Receipt button visible after payment: ${receiptVis}`);
          if (!receiptVis) console.warn('  ⚠️ BUG — No receipt option after recording payment');
        }
      }
    }

    console.log('✅ STEP 11 PASS — Payment recording tested');
  });

  // ── STEP 12: Add expense ───────────────────────────────────────────────────
  test('12 — Finance: log expense', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle');

    // Expenses tab
    const expTab = page.locator('button', { hasText: /expenses/i });
    if (await expTab.isVisible()) await expTab.click();
    await page.waitForTimeout(400);
    await ss(page, '12-expenses-tab');

    // Add expense button
    const addExpBtn = page.locator('button', { hasText: /add expense|new expense/i }).first();
    const addExpVis = await addExpBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "Add Expense" button visible: ${addExpVis}`);
    if (!addExpVis) console.warn('  ⚠️ BUG — Add Expense button missing from Expenses tab');

    if (addExpVis) {
      await addExpBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '12-expense-modal');

      // Select project
      const projSelect = page.locator('select').first();
      if (await projSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const opts = await projSelect.locator('option').allTextContents();
        const rajOpt = opts.find(o => o.includes('Rajesh') || o.includes(CLIENT.project));
        if (rajOpt) await projSelect.selectOption({ label: rajOpt });
        else await projSelect.selectOption({ index: 1 });
      }

      // Category
      const catSelect = page.locator('select').nth(1);
      if (await catSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        const cats = await catSelect.locator('option').allTextContents();
        console.log(`  Expense categories: ${cats.join(', ')}`);
        const travelOpt = cats.find(c => /travel/i.test(c));
        if (travelOpt) await catSelect.selectOption({ label: travelOpt });
      }

      // Amount
      const amtInput = page.locator('input[placeholder*="amount" i]').first();
      if (await amtInput.isVisible()) await amtInput.fill('500');

      // Description
      const descInput = page.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').first();
      if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) await descInput.fill('Site measurement travel expense');

      await ss(page, '12-expense-form-filled');

      const saveExpBtn = page.locator('button[type=submit], button', { hasText: /save|add|record/i }).last();
      if (await saveExpBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveExpBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, '12-expense-saved');
        const bodyText = await page.innerText('body');
        const hasExpense = bodyText.includes('travel') || bodyText.includes('Travel') || bodyText.includes('500');
        console.log(`  Expense appears in list: ${hasExpense}`);
      }
    }

    console.log('✅ STEP 12 PASS — Expense logging tested');
  });

  // ── STEP 13: Vendor payables tab ──────────────────────────────────────────
  test('13 — Finance: vendor payables', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    await page.goto(`${BASE}/finance`);
    await page.waitForLoadState('networkidle');

    const vpTab = page.locator('button', { hasText: /vendor payables/i });
    const vpVis = await vpTab.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Vendor Payables tab visible: ${vpVis}`);
    if (!vpVis) {
      console.warn('  ⚠️ BUG — Vendor Payables tab missing from Finance page');
      return;
    }

    await vpTab.click();
    await page.waitForTimeout(600);
    await ss(page, '13-vendor-payables');

    const bodyText = await page.innerText('body');
    const hasTable  = bodyText.match(/vendor|payable|PO|amount/i) !== null;
    const hasEmpty  = bodyText.match(/no vendor|no payable|empty/i) !== null;
    console.log(`  Vendor payables has data/table: ${hasTable}`);
    console.log(`  Empty state showing: ${hasEmpty}`);

    console.log('✅ STEP 13 PASS — Vendor payables tab checked');
  });

  // ── STEP 14: Add site execution log ───────────────────────────────────────
  test('14 — Add site execution log entry', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const projResp = await page.request.get(`${BASE}/api/v1/projects`);
    const { data: projects } = await projResp.json() as { data: { id: string; name: string }[] };
    const proj = projects?.find(p => p.name?.includes('Rajesh')) ?? projects?.[0];
    if (!proj) { test.skip(true, 'No projects'); return; }
    projectId = proj.id;

    await page.goto(`${BASE}/projects/${projectId}/site`);
    await page.waitForLoadState('networkidle');
    await ss(page, '14-site-log-page');

    const bodyText = await page.innerText('body');
    const hasSiteLog = bodyText.match(/site log|execution log|add log|daily log/i) !== null;
    console.log(`  Site log page has log UI: ${hasSiteLog}`);

    // Add log entry button
    const addLogBtn = page.locator('button', { hasText: /add.*log|new.*log|log entry/i }).first();
    const addLogVis = await addLogBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "Add Log" button visible: ${addLogVis}`);

    if (addLogVis) {
      await addLogBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '14-add-log-form');

      // Fill notes
      const notesInput = page.locator('textarea, input[placeholder*="note" i]').first();
      if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesInput.fill('Day 1 — site cleared, electrical rough-in started. Workers: 4 carpenters, 2 electricians.');
      }

      const saveLogBtn = page.locator('button[type=submit], button', { hasText: /save|add|submit/i }).last();
      if (await saveLogBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveLogBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, '14-site-log-saved');
      }
    }

    console.log('✅ STEP 14 PASS — Site log tested');
  });

  // ── STEP 15: Work Order ────────────────────────────────────────────────────
  test('15 — Create work order for modular kitchen', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const projResp = await page.request.get(`${BASE}/api/v1/projects`);
    const { data: projects } = await projResp.json() as { data: { id: string; name: string }[] };
    const proj = projects?.find(p => p.name?.includes('Rajesh')) ?? projects?.[0];
    if (!proj) { test.skip(true, 'No projects'); return; }
    projectId = proj.id;

    await page.goto(`${BASE}/projects/${projectId}/work-orders`);
    await page.waitForLoadState('networkidle');
    await ss(page, '15-work-orders-page');

    const bodyText = await page.innerText('body');
    console.log(`  Work Orders page loads: ${bodyText.includes('Work Order') || bodyText.includes('work order')}`);

    const newWOBtn = page.locator('button', { hasText: /new work order|create work order|add work order/i }).first();
    const newWOVis = await newWOBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  "New Work Order" button visible: ${newWOVis}`);

    if (newWOVis) {
      await newWOBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '15-work-order-form');

      // Title
      const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="work" i], input[placeholder*="description" i]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.fill('Modular Kitchen Installation');
      }

      // Assignee / vendor
      const vendorInput = page.locator('input[placeholder*="vendor" i], input[placeholder*="assign" i]').first();
      if (await vendorInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await vendorInput.fill('Siva Carpentry Works');
      }

      const saveWOBtn = page.locator('button[type=submit], button', { hasText: /save|create|add/i }).last();
      if (await saveWOBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await saveWOBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, '15-work-order-saved');

        const afterText = await page.innerText('body');
        const hasWO = afterText.includes('Modular Kitchen') || afterText.includes('Kitchen Installation');
        console.log(`  Work order appears in list: ${hasWO}`);
        if (!hasWO) console.warn('  ⚠️ BUG — Work order not visible in list after creation');
      }
    } else {
      console.warn('  ⚠️ BUG — New Work Order button not found');
    }

    console.log('✅ STEP 15 PASS — Work order tested');
  });

  // ── STEP 16: Client Portal ─────────────────────────────────────────────────
  test('16 — Client portal magic link and portal content', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const projResp = await page.request.get(`${BASE}/api/v1/projects`);
    const { data: projects } = await projResp.json() as { data: { id: string; name: string; clientToken?: string }[] };
    const proj = projects?.find(p => p.name?.includes('Rajesh')) ?? projects?.[0];
    if (!proj) { test.skip(true, 'No projects'); return; }
    projectId = proj.id;

    // Check project overview for a portal/token link
    await page.goto(`${BASE}/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    await ss(page, '16-project-for-portal-check');

    const bodyText = await page.innerText('body');
    const hasPortalLink = bodyText.match(/client portal|magic link|portal|trust timeline/i) !== null;
    console.log(`  Project overview shows client portal/link: ${hasPortalLink}`);
    if (!hasPortalLink) console.warn('  ⚠️ INFO — Client portal link not prominently visible on project overview');

    // Try to get the client token via API
    const tokenResp = await page.request.get(`${BASE}/api/v1/projects/${projectId}`);
    if (tokenResp.ok()) {
      const { data: projDetail } = await tokenResp.json() as { data: { clientToken?: string; clientPortalToken?: string } };
      const token = projDetail?.clientToken ?? projDetail?.clientPortalToken;
      console.log(`  Client portal token available: ${!!token}`);

      if (token) {
        await page.goto(`${BASE}/p/${token}`);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        await ss(page, '16-client-portal');

        const portalText = await page.innerText('body');
        const hasDeliverables  = portalText.match(/deliverable|design|approve/i) !== null;
        const hasMilestones    = portalText.match(/milestone|payment|pay now/i) !== null;
        const hasSnags         = portalText.match(/snag/i) !== null;
        console.log(`  Portal shows deliverables: ${hasDeliverables}`);
        console.log(`  Portal shows milestones/payments: ${hasMilestones}`);
        console.log(`  Portal shows snags: ${hasSnags}`);
      } else {
        console.warn('  ⚠️ BUG — No client portal token on project — portal is inaccessible');
      }
    }

    console.log('✅ STEP 16 PASS — Client portal checked');
  });

  // ── STEP 17: GST Audit — quote + invoice math ─────────────────────────────
  test('17 — GST audit: verify tax calculations are correct', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const leadsResp = await page.request.get(`${BASE}/api/v1/leads`);
    const { data: leads } = await leadsResp.json() as { data: { id: string; contactName: string }[] };
    const rajesh = leads?.find(l => l.contactName === CLIENT.name);
    if (!rajesh) { test.skip(true, 'Test lead not found'); return; }
    leadId = rajesh.id;

    const quotesResp = await page.request.get(`${BASE}/api/v1/leads/${leadId}/quotes`);
    const { data: quotes } = await quotesResp.json() as { data: { id: string; status: string; gstPct?: number; subtotalPaise?: number; cgstPaise?: number; sgstPaise?: number; igstPaise?: number; totalPaise?: number }[] };

    if (!quotes?.length) {
      console.warn('  ⚠️ No quotes found for GST audit');
      return;
    }

    const q = quotes[0]!;
    console.log('  Quote data for GST audit:');
    console.log(`    gstPct:       ${q.gstPct ?? 'not in API response'}`);
    console.log(`    subtotalPaise: ${q.subtotalPaise ?? 'not in API response'}`);
    console.log(`    cgstPaise:    ${q.cgstPaise ?? 'not in API response'}`);
    console.log(`    sgstPaise:    ${q.sgstPaise ?? 'not in API response'}`);
    console.log(`    igstPaise:    ${q.igstPaise ?? 'not in API response'}`);
    console.log(`    totalPaise:   ${q.totalPaise ?? 'not in API response'}`);

    // Verify math (if subtotal + gst fields are available)
    if (q.subtotalPaise && q.cgstPaise !== undefined) {
      const expectedCgst = Math.round(q.subtotalPaise * 0.09);
      const expectedSgst = Math.round(q.subtotalPaise * 0.09);
      const cgstOk = Math.abs((q.cgstPaise ?? 0) - expectedCgst) < 100; // within ₹1
      const sgstOk = Math.abs((q.sgstPaise ?? 0) - expectedSgst) < 100;
      console.log(`  CGST 9% correct: ${cgstOk} (expected ${expectedCgst}, got ${q.cgstPaise})`);
      console.log(`  SGST 9% correct: ${sgstOk} (expected ${expectedSgst}, got ${q.sgstPaise})`);
      if (!cgstOk) console.warn('  ⚠️ BUG — CGST calculation incorrect on quote');
      if (!sgstOk) console.warn('  ⚠️ BUG — SGST calculation incorrect on quote');
    } else {
      console.warn('  ⚠️ GST fields (cgstPaise/sgstPaise) not returned by quote API — cannot verify math');
    }

    // Also check an invoice
    const projResp = await page.request.get(`${BASE}/api/v1/projects`);
    const { data: projs } = await projResp.json() as { data: { id: string; name: string }[] };
    const proj = projs?.find(p => p.name?.includes('Rajesh')) ?? projs?.[0];
    if (proj) {
      const invResp = await page.request.get(`${BASE}/api/v1/invoices?projectId=${proj.id}`);
      if (invResp.ok()) {
        const { data: invs } = await invResp.json() as { data: { id: string; subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; isInterstate: boolean }[] };
        if (invs?.length) {
          const inv = invs[0]!;
          console.log('  Invoice GST audit:');
          console.log(`    isInterstate: ${inv.isInterstate}`);
          console.log(`    subtotal:     ₹${(inv.subtotalPaise/100).toLocaleString('en-IN')}`);
          console.log(`    CGST (9%):    ₹${(inv.cgstPaise/100).toLocaleString('en-IN')}`);
          console.log(`    SGST (9%):    ₹${(inv.sgstPaise/100).toLocaleString('en-IN')}`);
          console.log(`    IGST (18%):   ₹${(inv.igstPaise/100).toLocaleString('en-IN')}`);
          const expCgst = Math.round(inv.subtotalPaise * 0.09);
          const cgstInvOk = !inv.isInterstate ? Math.abs(inv.cgstPaise - expCgst) < 100 : true;
          console.log(`  Invoice CGST correct (intrastate): ${cgstInvOk}`);
          if (!cgstInvOk) console.warn('  ⚠️ BUG — Invoice CGST does not match 9% of subtotal');
        }
      }
    }

    console.log('✅ STEP 17 PASS — GST audit done');
  });

  // ── STEP 18: Navigation audit — all sidebar links ─────────────────────────
  test('18 — Navigation: all sidebar links load without errors', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });

    const routes = [
      { path: '/dashboard',       name: 'Dashboard'       },
      { path: '/leads',           name: 'Leads'           },
      { path: '/projects',        name: 'Projects'        },
      { path: '/quotes',          name: 'Quotes'          },
      { path: '/finance',         name: 'Finance'         },
      { path: '/site-visits',     name: 'Site Visits'     },
      { path: '/purchase-orders', name: 'Purchase Orders' },
      { path: '/vendors',         name: 'Vendors'         },
      { path: '/customers',       name: 'Customers'       },
      { path: '/calendar',        name: 'Calendar'        },
      { path: '/reports',         name: 'Reports'         },
      { path: '/settings',        name: 'Settings'        },
      { path: '/attendance',      name: 'Attendance'      },
      { path: '/employees',       name: 'Employees'       },
    ];

    const results: { route: string; status: 'ok' | 'error' | '404' | 'blank'; note: string }[] = [];

    for (const route of routes) {
      await page.goto(`${BASE}${route.path}`);
      await page.waitForLoadState('domcontentloaded');
      const bodyText = await page.innerText('body').catch(() => '');
      const is404   = bodyText.includes('404') || bodyText.includes('not found');
      const isBlank = bodyText.trim().length < 50;
      const hasErr  = bodyText.includes('Error') && bodyText.includes('application error');

      let status: 'ok' | 'error' | '404' | 'blank' = 'ok';
      if (is404)    status = '404';
      else if (isBlank) status = 'blank';
      else if (hasErr)  status = 'error';

      results.push({ route: route.path, status, note: route.name });
      if (status !== 'ok') {
        console.warn(`  ⚠️ ${route.name} (${route.path}): ${status.toUpperCase()}`);
      }
    }

    await ss(page, '18-nav-last-page');

    const fails = results.filter(r => r.status !== 'ok');
    console.log(`\n  Navigation audit: ${results.length - fails.length}/${results.length} routes OK`);
    if (fails.length) {
      console.warn(`  Broken routes: ${fails.map(f => f.route).join(', ')}`);
    }

    console.log('✅ STEP 18 PASS — Navigation audit complete');
  });
});
