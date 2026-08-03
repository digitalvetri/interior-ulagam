import { and, eq, ne, sql } from 'drizzle-orm';
import { defineJob } from '@/jobs/define';
import { db } from '@/lib/db';
import { projects, quotes, quoteLines, expenses, users } from '@/lib/db/schema';

interface ProjectRow {
  id: string;
  tenantId: string;
  name: string;
}

interface OverrunCheckResult {
  projectId: string;
  tenantId: string;
  projectName: string;
  burnPct: number;
  quotedCostPaise: number;
  actualSpendPaise: number;
  ownerPhone: string | null;
  eventFired: boolean;
}

export const costOverrunAlert = defineJob(
  {
    id: 'cost-overrun-alert',
    name: 'Daily Cost Overrun Alert',
  },
  { cron: '0 18 * * *' },
  async ({ step }) => {

    // ── Step 1: Find all active projects across all tenants ──────────────────
    const activeProjects = await step.run('find-at-risk-projects', async (): Promise<ProjectRow[]> => {
      return db
        .select({
          id: projects.id,
          tenantId: projects.tenantId,
          name: projects.name,
        })
        .from(projects)
        .where(ne(projects.lifecycleStage, 'complete'));
    });

    if (activeProjects.length === 0) {
      return { atRiskCount: 0, checked: 0 };
    }

    // ── Step 2: Check each project for cost overrun ───────────────────────────
    // Use unique step IDs per project to satisfy Inngest memoization requirements.
    const results: OverrunCheckResult[] = [];

    for (const project of activeProjects) {
      const result = await step.run(`check-${project.id}`, async (): Promise<OverrunCheckResult> => {
        // a) Approved quote cost: SUM(costRatePaise * qty) from approved quotes for this project.
        //    quoteLines has no tenantId — filter via joined quotes table.
        const [quoteCostRow] = await db
          .select({
            totalCost: sql<string>`coalesce(sum(${quoteLines.costRatePaise} * ${quoteLines.qty}), 0)`,
          })
          .from(quoteLines)
          .innerJoin(quotes, eq(quoteLines.quoteId, quotes.id))
          .where(
            and(
              eq(quotes.projectId, project.id),
              eq(quotes.tenantId, project.tenantId),
              eq(quotes.status, 'approved'),
            ),
          );

        // b) Actual expenses: SUM(amountPaise) from expenses for this project.
        const [expenseRow] = await db
          .select({
            totalSpend: sql<string>`coalesce(sum(${expenses.amountPaise}), 0)`,
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.projectId, project.id),
              eq(expenses.tenantId, project.tenantId),
            ),
          );

        // Postgres SUM returns a numeric string or null — coerce to number.
        const quotedCostPaise = Number(quoteCostRow?.totalCost ?? 0);
        const actualSpendPaise = Number(expenseRow?.totalSpend ?? 0);

        // c) Compute burn percentage (guard against divide-by-zero).
        const burnPct = quotedCostPaise > 0
          ? Math.round((actualSpendPaise / quotedCostPaise) * 100)
          : 0;

        // d) If at or above 80% burn, fetch the tenant owner's phone and fire an event.
        if (burnPct >= 80) {
          const [owner] = await db
            .select({ phone: users.phone })
            .from(users)
            .where(
              and(
                eq(users.tenantId, project.tenantId),
                eq(users.role, 'owner'),
              ),
            )
            .limit(1);

          const ownerPhone = owner?.phone ?? null;

          await step.sendEvent(`fire-overrun-${project.id}`, {
            name: 'project/cost_overrun_detected',
            data: {
              projectId: project.id,
              tenantId: project.tenantId,
              projectName: project.name,
              burnPct,
              quotedCostPaise,
              actualSpendPaise,
              ownerPhone,
            },
          });

          return {
            projectId: project.id,
            tenantId: project.tenantId,
            projectName: project.name,
            burnPct,
            quotedCostPaise,
            actualSpendPaise,
            ownerPhone,
            eventFired: true,
          };
        }

        return {
          projectId: project.id,
          tenantId: project.tenantId,
          projectName: project.name,
          burnPct,
          quotedCostPaise,
          actualSpendPaise,
          ownerPhone: null,
          eventFired: false,
        };
      });

      results.push(result);
    }

    const atRiskProjects = results.filter((r) => r.eventFired);

    return {
      checked: activeProjects.length,
      atRiskCount: atRiskProjects.length,
      atRisk: atRiskProjects.map((r) => ({
        projectId: r.projectId,
        projectName: r.projectName,
        burnPct: r.burnPct,
      })),
    };
  },
);
