/**
 * Konstdesign CRM — data migration script (ADR-8)
 *
 * Migrates an Interior OS database to the Konstdesign schema:
 *   1. Maps legacy lead stages to canonical values
 *   2. Maps legacy roles → admin/employee + permission flags
 *   3. Backfills lead.followUpDate rows into lead_follow_ups
 *   4. Backfills customers from leads (upsert by phone)
 *   5. Verifies FK integrity and reports orphaned rows
 *
 * Usage:
 *   npx tsx scripts/migrate-konstdesign.ts            # dry-run (default)
 *   npx tsx scripts/migrate-konstdesign.ts --apply    # write to DB
 *
 * Always run against a copy first. The script is idempotent — re-running
 * after --apply is safe; already-migrated rows are skipped.
 */

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  and, eq, isNull, isNotNull, inArray, notInArray, sql,
} from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

const DRY_RUN = !process.argv.includes('--apply');

// ── Connection ────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Source .env.local first:\n  set -a && . .env.local && set +a');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

// ── Stage map ─────────────────────────────────────────────────────────────────

type LeadStage = typeof schema.leadStageEnum.enumValues[number];

const LEGACY_STAGE_MAP: Record<string, LeadStage> = {
  site_visit_scheduled: 'site_visit',
  consultation_done:    'site_visit',
  proposal_sent:        'quotation',
  measured:             'measurement',
  booked:               'won',
};

const CANONICAL_STAGES = new Set<string>([
  'new', 'contacted', 'qualified', 'site_visit', 'measurement',
  'quotation', 'negotiation', 'won', 'lost',
]);

// ── Permission presets ────────────────────────────────────────────────────────

interface Permissions {
  canSeeFinance: boolean;
  canCreateQuotes: boolean;
  canSendQuotes: boolean;
  canRaisePO: boolean;
  canRecordPayments: boolean;
  canSeeAllLeads: boolean;
}

const ROLE_PERMS: Record<string, Permissions> = {
  owner: {
    canSeeFinance: true, canCreateQuotes: true, canSendQuotes: true,
    canRaisePO: true, canRecordPayments: true, canSeeAllLeads: true,
  },
  designer: {
    canSeeFinance: false, canCreateQuotes: true, canSendQuotes: true,
    canRaisePO: false, canRecordPayments: false, canSeeAllLeads: false,
  },
  accountant: {
    canSeeFinance: true, canCreateQuotes: false, canSendQuotes: false,
    canRaisePO: false, canRecordPayments: true, canSeeAllLeads: true,
  },
  supervisor: {
    canSeeFinance: false, canCreateQuotes: false, canSendQuotes: false,
    canRaisePO: false, canRecordPayments: false, canSeeAllLeads: false,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg); }
function warn(msg: string) { console.warn('\x1b[33m  ⚠ ' + msg + '\x1b[0m'); }
function ok(msg: string)   { console.log('\x1b[32m  ✓ ' + msg + '\x1b[0m'); }
function info(msg: string) { console.log('\x1b[36m  → ' + msg + '\x1b[0m'); }

function dryNote(count: number, what: string) {
  if (DRY_RUN) info(`[dry-run] would update ${count} ${what}`);
}

// ── STEP 1 — Before counts ────────────────────────────────────────────────────

interface BeforeCounts {
  leads: number;
  legacyStageLeads: number;
  legacyRoleUsers: number;
  leadsWithFollowUpDate: number;
  leadsWithoutCustomer: number;
  customers: number;
  followUps: number;
}

async function countBefore(): Promise<BeforeCounts> {
  const legacyStages = Object.keys(LEGACY_STAGE_MAP) as LeadStage[];

  const [
    [{ n: leads }],
    [{ n: legacyStageLeads }],
    [{ n: legacyRoleUsers }],
    [{ n: leadsWithFollowUpDate }],
    [{ n: leadsWithoutCustomer }],
    [{ n: customers }],
    [{ n: followUps }],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads)
       .where(inArray(schema.leads.stage, legacyStages)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users)
       .where(inArray(schema.users.role, ['owner', 'designer', 'accountant', 'supervisor'] as typeof schema.userRoleEnum.enumValues)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads)
       .where(isNotNull(schema.leads.followUpDate)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads)
       .where(isNull(schema.leads.customerId)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.customers),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leadFollowUps),
  ]);

  return {
    leads:                Number(leads),
    legacyStageLeads:     Number(legacyStageLeads),
    legacyRoleUsers:      Number(legacyRoleUsers),
    leadsWithFollowUpDate: Number(leadsWithFollowUpDate),
    leadsWithoutCustomer: Number(leadsWithoutCustomer),
    customers:            Number(customers),
    followUps:            Number(followUps),
  };
}

// ── STEP 2 — Lead stage migration ────────────────────────────────────────────

async function migrateLeadStages(): Promise<{ updated: number; skipped: number }> {
  const legacyStages = Object.keys(LEGACY_STAGE_MAP) as LeadStage[];

  const staleLeads = await db
    .select({ id: schema.leads.id, stage: schema.leads.stage, tenantId: schema.leads.tenantId })
    .from(schema.leads)
    .where(inArray(schema.leads.stage, legacyStages));

  if (staleLeads.length === 0) { ok('No legacy lead stages to migrate'); return { updated: 0, skipped: 0 }; }

  info(`Found ${staleLeads.length} leads with legacy stages`);

  const byNewStage = new Map<LeadStage, string[]>();
  for (const lead of staleLeads) {
    const newStage = LEGACY_STAGE_MAP[lead.stage];
    if (!newStage) continue;
    if (!byNewStage.has(newStage)) byNewStage.set(newStage, []);
    byNewStage.get(newStage)!.push(lead.id);
  }

  for (const [newStage, ids] of byNewStage) {
    info(`  ${ids.length}× → ${newStage}`);
    if (!DRY_RUN) {
      await db.update(schema.leads)
        .set({ stage: newStage })
        .where(inArray(schema.leads.id, ids));
    }
  }

  dryNote(staleLeads.length, 'lead stages');
  return { updated: DRY_RUN ? 0 : staleLeads.length, skipped: 0 };
}

// ── STEP 3 — Role / permission migration ──────────────────────────────────────

async function migrateRoles(): Promise<{ updated: number }> {
  const legacyRoles = ['owner', 'designer', 'accountant', 'supervisor'] as typeof schema.userRoleEnum.enumValues;

  const oldUsers = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(inArray(schema.users.role, legacyRoles));

  if (oldUsers.length === 0) { ok('No legacy roles to migrate'); return { updated: 0 }; }

  info(`Found ${oldUsers.length} users with legacy roles`);

  let updated = 0;
  for (const user of oldUsers) {
    const perms = ROLE_PERMS[user.role] ?? ROLE_PERMS.supervisor;
    const newRole = user.role === 'owner' ? 'admin' : 'employee';
    info(`  ${user.id.slice(0, 8)}… ${user.role} → ${newRole}`);
    if (!DRY_RUN) {
      await db.update(schema.users)
        .set({ role: newRole as typeof schema.userRoleEnum.enumValues[number], permissionsJson: perms })
        .where(eq(schema.users.id, user.id));
      updated++;
    }
  }

  dryNote(oldUsers.length, 'user roles');
  return { updated: DRY_RUN ? 0 : updated };
}

// ── STEP 4 — Consolidate follow-up dates into lead_follow_ups ─────────────────

async function consolidateFollowUps(): Promise<{ created: number }> {
  // Leads with a followUpDate that have NO corresponding lead_follow_ups row yet.
  // We check by looking for leads where followUpDate is set but there are no
  // leadFollowUps rows referencing the same lead with a matching date.
  const leadsWithDate = await db
    .select({
      id:          schema.leads.id,
      tenantId:    schema.leads.tenantId,
      followUpDate: schema.leads.followUpDate,
      stage:       schema.leads.stage,
    })
    .from(schema.leads)
    .where(isNotNull(schema.leads.followUpDate));

  if (leadsWithDate.length === 0) {
    ok('No lead.followUpDate rows to consolidate'); return { created: 0 };
  }

  // Fetch all existing follow-up rows for these leads
  const leadIds = leadsWithDate.map(l => l.id);
  const existingRows = await db
    .select({ leadId: schema.leadFollowUps.leadId })
    .from(schema.leadFollowUps)
    .where(inArray(schema.leadFollowUps.leadId, leadIds));

  const alreadyHasFollowUp = new Set(existingRows.map(r => r.leadId));

  const toCreate = leadsWithDate.filter(l => !alreadyHasFollowUp.has(l.id));

  if (toCreate.length === 0) { ok('All follow-up dates already consolidated'); return { created: 0 }; }

  info(`Consolidating ${toCreate.length} follow-up date(s) into lead_follow_ups`);

  if (!DRY_RUN) {
    await db.insert(schema.leadFollowUps).values(
      toCreate.map(l => ({
        tenantId:    l.tenantId,
        leadId:      l.id,
        followUpDate: l.followUpDate,
        stage:       l.stage ?? 'new',
        clientStatus: 'pending',
        comments:    'Migrated from lead.follow_up_date',
      })),
    );
  }

  dryNote(toCreate.length, 'follow-up rows to create');
  return { created: DRY_RUN ? 0 : toCreate.length };
}

// ── STEP 5 — Backfill customers ───────────────────────────────────────────────

async function backfillCustomers(): Promise<{ created: number; linked: number; skipped: number }> {
  const unlinked = await db
    .select({
      id:              schema.leads.id,
      tenantId:        schema.leads.tenantId,
      contactName:     schema.leads.contactName,
      contactPhone:    schema.leads.contactPhone,
      contactEmail:    schema.leads.contactEmail,
      source:          schema.leads.source,
      stage:           schema.leads.stage,
      ownerId:         schema.leads.ownerId,
      contactCity:     schema.leads.contactCity,
      projectLocation: schema.leads.projectLocation,
    })
    .from(schema.leads)
    .where(isNull(schema.leads.customerId));

  if (unlinked.length === 0) { ok('All leads already have customers'); return { created: 0, linked: 0, skipped: 0 }; }

  info(`Backfilling customers for ${unlinked.length} unlinked lead(s)`);

  const LEAD_TO_CUSTOMER_STAGE: Record<string, typeof schema.customerStageEnum.enumValues[number]> = {
    new: 'lead', contacted: 'lead', qualified: 'opportunity',
    site_visit: 'opportunity', measurement: 'opportunity', quotation: 'opportunity',
    negotiation: 'opportunity', won: 'client', lost: 'lead',
  };
  const STAGE_RANK: Record<string, number> = { lead: 0, opportunity: 1, client: 2, past_client: 3 };

  type ValidSource = typeof schema.customerSourceEnum.enumValues[number];
  const VALID_SOURCES = new Set<string>(['referral', 'instagram', 'whatsapp', 'website', 'walk_in', 'imported', 'other']);
  const toSource = (s: string): ValidSource => VALID_SOURCES.has(s) ? s as ValidSource : 'other';

  let created = 0; let linked = 0; let skipped = 0;

  for (const lead of unlinked) {
    try {
      const targetStage = LEAD_TO_CUSTOMER_STAGE[lead.stage] ?? 'lead';

      if (DRY_RUN) { linked++; continue; }

      const [existing] = await db
        .select({ id: schema.customers.id, stage: schema.customers.stage })
        .from(schema.customers)
        .where(and(
          eq(schema.customers.tenantId, lead.tenantId),
          eq(schema.customers.phone, lead.contactPhone),
        ))
        .limit(1);

      let customerId: string;

      if (existing) {
        customerId = existing.id;
        if (STAGE_RANK[targetStage] > STAGE_RANK[existing.stage]) {
          await db.update(schema.customers)
            .set({ stage: targetStage })
            .where(eq(schema.customers.id, existing.id));
        }
        linked++;
      } else {
        const [row] = await db.insert(schema.customers).values({
          tenantId: lead.tenantId,
          fullName: lead.contactName,
          phone: lead.contactPhone,
          email: lead.contactEmail ?? null,
          source: toSource(lead.source),
          stage: targetStage,
          ownerId: lead.ownerId ?? null,
          city: lead.contactCity ?? lead.projectLocation ?? null,
          leadId: lead.id,
        }).returning({ id: schema.customers.id });
        customerId = row.id;
        created++;
      }

      await db.update(schema.leads)
        .set({ customerId })
        .where(eq(schema.leads.id, lead.id));

    } catch (e) {
      warn(`Failed to backfill lead ${lead.id}: ${e}`);
      skipped++;
    }
  }

  return { created, linked, skipped };
}

// ── STEP 6 — FK integrity check ───────────────────────────────────────────────

interface FkReport {
  orphanedLeadActivities: number;
  orphanedSiteVisits: number;
  orphanedQuotes: number;
  orphanedMilestones: number;
  orphanedExpenses: number;
  orphanedGrns: number;
}

async function verifyFkIntegrity(): Promise<FkReport> {
  const [
    [{ n: orphanedLeadActivities }],
    [{ n: orphanedSiteVisits }],
    [{ n: orphanedQuotes }],
    [{ n: orphanedMilestones }],
    [{ n: orphanedExpenses }],
    [{ n: orphanedGrns }],
  ] = await Promise.all([
    // lead_activities → leads
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.leadActivities)
      .where(notInArray(
        schema.leadActivities.leadId,
        db.select({ id: schema.leads.id }).from(schema.leads),
      )),
    // site_visits → leads
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.siteVisits)
      .where(notInArray(
        schema.siteVisits.leadId,
        db.select({ id: schema.leads.id }).from(schema.leads),
      )),
    // quotes → leads (where leadId is set)
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.quotes)
      .where(and(
        isNotNull(schema.quotes.leadId),
        notInArray(
          schema.quotes.leadId!,
          db.select({ id: schema.leads.id }).from(schema.leads),
        ),
      )),
    // milestones → projects
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.milestones)
      .where(notInArray(
        schema.milestones.projectId,
        db.select({ id: schema.projects.id }).from(schema.projects),
      )),
    // expenses → projects
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.expenses)
      .where(notInArray(
        schema.expenses.projectId,
        db.select({ id: schema.projects.id }).from(schema.projects),
      )),
    // grns → purchase_orders
    db.select({ n: sql<number>`count(*)::int` })
      .from(schema.grns)
      .where(notInArray(
        schema.grns.poId,
        db.select({ id: schema.purchaseOrders.id }).from(schema.purchaseOrders),
      )),
  ]);

  return {
    orphanedLeadActivities: Number(orphanedLeadActivities),
    orphanedSiteVisits:     Number(orphanedSiteVisits),
    orphanedQuotes:         Number(orphanedQuotes),
    orphanedMilestones:     Number(orphanedMilestones),
    orphanedExpenses:       Number(orphanedExpenses),
    orphanedGrns:           Number(orphanedGrns),
  };
}

// ── STEP 7 — After counts ─────────────────────────────────────────────────────

async function countAfter() {
  const legacyStages = Object.keys(LEGACY_STAGE_MAP) as LeadStage[];
  const legacyRoles = ['owner', 'designer', 'accountant', 'supervisor'] as typeof schema.userRoleEnum.enumValues;

  const [
    [{ n: legacyStageLeads }],
    [{ n: legacyRoleUsers }],
    [{ n: leadsWithoutCustomer }],
    [{ n: customers }],
    [{ n: followUps }],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads)
       .where(inArray(schema.leads.stage, legacyStages)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users)
       .where(inArray(schema.users.role, legacyRoles)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leads)
       .where(isNull(schema.leads.customerId)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.customers),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.leadFollowUps),
  ]);

  return {
    legacyStageLeads:    Number(legacyStageLeads),
    legacyRoleUsers:     Number(legacyRoleUsers),
    leadsWithoutCustomer: Number(leadsWithoutCustomer),
    customers:           Number(customers),
    followUps:           Number(followUps),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mode = DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY (writing to DB)';
  log(`\n╔══════════════════════════════════════════════════════╗`);
  log(`║  Konstdesign CRM — Data Migration (ADR-8)            ║`);
  log(`║  Mode: ${mode.padEnd(44)}║`);
  log(`╚══════════════════════════════════════════════════════╝\n`);

  if (!DRY_RUN) {
    warn('APPLY mode active — changes will be written to the database.');
    warn('Ensure you have a backup before proceeding.\n');
  }

  // ── Before ──────────────────────────────────────────────────────────────────
  log('── Before ──────────────────────────────────────────────');
  const before = await countBefore();
  log(`  Leads total:                ${before.leads}`);
  log(`  Leads with legacy stages:   ${before.legacyStageLeads}`);
  log(`  Users with legacy roles:    ${before.legacyRoleUsers}`);
  log(`  Leads with followUpDate:    ${before.leadsWithFollowUpDate}`);
  log(`  Leads without customer:     ${before.leadsWithoutCustomer}`);
  log(`  Customers total:            ${before.customers}`);
  log(`  lead_follow_ups rows:       ${before.followUps}`);

  // ── Steps ───────────────────────────────────────────────────────────────────
  log('\n── Step 2: Lead stage migration ────────────────────────');
  const stageResult = await migrateLeadStages();

  log('\n── Step 3: Role / permission migration ─────────────────');
  const roleResult = await migrateRoles();

  log('\n── Step 4: Follow-up date consolidation ────────────────');
  const fuResult = await consolidateFollowUps();

  log('\n── Step 5: Customer backfill ───────────────────────────');
  const custResult = await backfillCustomers();

  log('\n── Step 6: FK integrity check ──────────────────────────');
  const fk = await verifyFkIntegrity();
  const fkClean = Object.values(fk).every(v => v === 0);
  if (fkClean) {
    ok('All FK checks passed — no orphaned rows found');
  } else {
    warn('Orphaned rows detected:');
    for (const [key, count] of Object.entries(fk)) {
      if (count > 0) warn(`  ${key}: ${count}`);
    }
  }

  // ── After ───────────────────────────────────────────────────────────────────
  log('\n── After ───────────────────────────────────────────────');
  const after = await countAfter();
  log(`  Leads with legacy stages:   ${after.legacyStageLeads}  (was ${before.legacyStageLeads})`);
  log(`  Users with legacy roles:    ${after.legacyRoleUsers}  (was ${before.legacyRoleUsers})`);
  log(`  Leads without customer:     ${after.leadsWithoutCustomer}  (was ${before.leadsWithoutCustomer})`);
  log(`  Customers total:            ${after.customers}  (was ${before.customers})`);
  log(`  lead_follow_ups rows:       ${after.followUps}  (was ${before.followUps})`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  log('\n── Summary ─────────────────────────────────────────────');
  log(`  Lead stages updated:        ${stageResult.updated}`);
  log(`  User roles updated:         ${roleResult.updated}`);
  log(`  Follow-ups consolidated:    ${fuResult.created}`);
  log(`  Customers created:          ${custResult.created}`);
  log(`  Customers linked:           ${custResult.linked}`);
  log(`  Customers skipped (errors): ${custResult.skipped}`);
  log(`  FK orphan total:            ${Object.values(fk).reduce((a, b) => a + b, 0)}`);

  if (DRY_RUN) {
    log('\n  ⚡ This was a dry run. No data was changed.');
    log('  Run with --apply to write changes:\n');
    log('    npx tsx scripts/migrate-konstdesign.ts --apply\n');
  } else {
    log('\n  ✅ Migration complete.\n');
    if (!fkClean) {
      warn('Orphaned rows require manual review — see RUNBOOK_GO_LIVE.md §4.');
    }
  }
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => client.end());
