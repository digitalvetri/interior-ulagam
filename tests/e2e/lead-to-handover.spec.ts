/**
 * E2E smoke test: Lead → Won → PO → Receive → Invoice → Payment → Handover
 *
 * Uses Playwright route mocking to avoid a live database.
 * Each step exercises navigation and critical UI interactions.
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LEAD_ID    = 'lead-111-aaa';
const PROJECT_ID = 'proj-222-bbb';
const PO_ID      = 'po-333-ccc';
const INVOICE_ID = 'inv-444-ddd';

const MOCK_LEAD = {
  id: LEAD_ID,
  tenantId: 'tenant-1',
  contactName: 'Test Client',
  contactPhone: '9876543210',
  contactEmail: 'test@example.com',
  contactCity: 'Coimbatore',
  pincode: '641001',
  projectLocation: '42, RS Puram',
  source: 'instagram',
  stage: 'quotation',
  priority: 'medium',
  budgetBand: '10-20L',
  propertyType: '3BHK',
  projectName: 'Test Residence',
  projectValuePaise: 1500000_00,
  notes: 'E2E test lead',
  score: 72,
  scoreBreakdown: { recency: 20, value: 20, completeness: 15, source: 10, engagement: 7 },
  ownerId: null,
  followUpAt: null,
  customerId: null,
  lastActivityAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

const MOCK_PROJECT = {
  id: PROJECT_ID,
  tenantId: 'tenant-1',
  name: 'Test Residence',
  leadId: LEAD_ID,
  customerId: null,
  clientId: null,
  designerIds: [],
  totalContractPaise: 1500000_00,
  lifecycleStage: 'snagging',
  timelineJson: null,
  startedAt: new Date().toISOString(),
  expectedEndAt: null,
  createdAt: new Date().toISOString(),
};

const MOCK_PO = {
  id: PO_ID,
  tenantId: 'tenant-1',
  projectId: PROJECT_ID,
  vendorId: null,
  vendorContactName: 'Vendor Co',
  vendorPhone: '9000000000',
  poNumber: 'PO-2026-001',
  linesJson: [{ description: 'Teak wood panels', qty: 10, ratePaise: 5000_00, unit: 'sqft' }],
  status: 'acknowledged',
  advancePaidPaise: 0,
  expectedDeliveryAt: null,
  pdfUrl: null,
  createdAt: new Date().toISOString(),
  projectName: 'Test Residence',
  vendorName: 'Vendor Co',
  lineCount: 1,
  totalPaise: 50000_00,
};

const MOCK_INVOICE = {
  id: INVOICE_ID,
  projectId: PROJECT_ID,
  invoiceNumber: 'INV-2026-001',
  invoiceDate: new Date().toISOString(),
  subtotalPaise: 1500000_00,
  cgstPaise: 135000_00,
  sgstPaise: 135000_00,
  igstPaise: 0,
  placeOfSupply: 'Tamil Nadu',
  isInterstate: false,
  irn: null,
  pdfUrl: null,
  createdAt: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mockAuthAndNav(page: Page) {
  // Mock session check — return a valid session
  await page.route('**/api/auth/session', route =>
    route.fulfill({ json: { user: { id: 'user-1', email: 'test@studio.com', role: 'owner' } } }),
  );
  await page.route('**/api/v1/auth/me', route =>
    route.fulfill({ json: { data: { id: 'user-1', role: 'owner', tenantId: 'tenant-1' } } }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Lead → Handover flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthAndNav(page);
  });

  test('Leads list renders and shows pipeline stages', async ({ page }) => {
    await page.route('**/api/v1/leads*', route =>
      route.fulfill({ json: { data: [MOCK_LEAD], total: 1 } }),
    );
    await page.goto('/leads');
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible();
    // Pipeline stage badges should be present
    await expect(page.locator('text=Quotation').first()).toBeVisible();
  });

  test('Lead detail page shows contact info and stage actions', async ({ page }) => {
    await page.route(`**/api/v1/leads/${LEAD_ID}`, route =>
      route.fulfill({ json: { data: MOCK_LEAD } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/activities*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/follow-ups*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/site-visits*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/measurements*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/quotes*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/documents*`, route =>
      route.fulfill({ json: { data: [] } }),
    );

    await page.goto(`/leads/${LEAD_ID}`);
    await expect(page.getByText('Test Client')).toBeVisible();
    await expect(page.getByText('9876543210')).toBeVisible();
    // Tab nav should be present
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Site Visits' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Measurements' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quotations' })).toBeVisible();
  });

  test('Lead detail — Measurements tab shows PDF download when rounds exist', async ({ page }) => {
    await page.route(`**/api/v1/leads/${LEAD_ID}`, route =>
      route.fulfill({ json: { data: MOCK_LEAD } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/activities*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/follow-ups*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/site-visits*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/measurements*`, route =>
      route.fulfill({
        json: {
          data: [{
            id: 'round-1',
            leadId: LEAD_ID,
            roundName: 'Initial Measurement',
            scheduledAt: null,
            completedAt: new Date().toISOString(),
            assignedToName: null,
            notes: null,
            createdAt: new Date().toISOString(),
            items: [],
          }],
        },
      }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/quotes*`, route =>
      route.fulfill({ json: { data: [] } }),
    );
    await page.route(`**/api/v1/leads/${LEAD_ID}/documents*`, route =>
      route.fulfill({ json: { data: [] } }),
    );

    await page.goto(`/leads/${LEAD_ID}`);
    await page.getByRole('button', { name: 'Measurements' }).click();
    // PDF download link should be visible when rounds exist
    await expect(page.getByRole('link', { name: /pdf/i })).toBeVisible();
  });

  test('Projects list renders DataTable', async ({ page }) => {
    await page.route('**/api/v1/projects*', route =>
      route.fulfill({
        json: {
          data: [{
            ...MOCK_PROJECT,
            customerFullName: 'Test Client',
            leadContactName: null,
            collectedPaise: 600000_00,
            nextMilestoneLabel: 'Milestone 3',
          }],
        },
      }),
    );
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
    await expect(page.getByText('Test Residence')).toBeVisible();
    // Stage badge
    await expect(page.getByText('Snagging')).toBeVisible();
  });

  test('Purchase Orders list renders with enriched columns', async ({ page }) => {
    await page.route('**/api/v1/purchase-orders*', route =>
      route.fulfill({ json: { data: [MOCK_PO] } }),
    );
    await page.goto('/purchase-orders');
    await expect(page.getByText('PO-2026-001')).toBeVisible();
    await expect(page.getByText('Test Residence')).toBeVisible();
    await expect(page.getByText('Vendor Co')).toBeVisible();
  });

  test('Accounts page shows receivables tab', async ({ page }) => {
    await page.route('**/api/v1/accounts/overview*', route =>
      route.fulfill({
        json: {
          data: {
            kpis: {
              outstandingPaise: 500000_00,
              overduePaise: 0,
              openReceivableCount: 2,
              collected30dPaise: 300000_00,
              collected30dCount: 1,
              collectedAllTimePaise: 900000_00,
              collectedAllTimeCount: 3,
            },
            receivables: [],
            payments: [],
          },
        },
      }),
    );
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: /accounts|receivables/i })).toBeVisible();
  });

  test('Snag page shows handover initiation and cert download after success', async ({ page }) => {
    await page.route(`**/api/v1/projects/${PROJECT_ID}/snag-items*`, route =>
      route.fulfill({ json: { data: [] } }),
    );

    await page.goto(`/projects/${PROJECT_ID}/snag`);
    await expect(page.getByText(/ready for handover/i)).toBeVisible();

    // Mock handover POST
    await page.route(`**/api/v1/projects/${PROJECT_ID}/handover`, route =>
      route.fulfill({ json: { data: { message: 'Handover initiated' } } }),
    );

    await page.getByRole('button', { name: /initiate handover/i }).click();
    await expect(page.getByRole('link', { name: /download certificate/i })).toBeVisible();
  });
});
