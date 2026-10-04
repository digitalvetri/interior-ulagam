# Civil Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Civil Management division (companies → cities → branches → jobs with material/labour lines, Pending→Done→Billed→Paid, Excel import/export) to the existing Next.js app.

**Architecture:** New `civil_*` Postgres tables (Drizzle schema + hand-written SQL migration 0020), pure logic in `src/lib/civil/` (unit-tested), JSON API under `src/app/api/v1/civil/**` following the vendors route pattern, client pages under `src/app/(dashboard)/civil/**` following the vendors page pattern and design tokens.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (postgres-js), Zod, Better Auth context (`getAuthContext`, `requireApiRole`), `xlsx` (already a dependency), Vitest, Tailwind + CSS variables from `globals.css`.

## Global Constraints

- Money is integer paise everywhere; format only with `formatRupees(paise)` from `@/lib/utils`.
- Every query filters `tenantId` (enforced by `tests/tenant-isolation.test.ts`).
- Every POST/PATCH/PUT/DELETE calls `requireApiRole(ctx, ROLES.CIVIL)` (enforced by `tests/role-enforcement.test.ts`).
- `ROLES.CIVIL = ['owner', 'accountant']`; nav roles `['admin','owner','accountant']`.
- No `any`, no `console.log`; `console.error('[civil/... METHOD]', err)` on 500s.
- UI uses existing classes/tokens: `studio-input`, `btn-primary`, `btn-secondary`, `var(--surface-card)`, `var(--border-subtle)`, `var(--accent-base)`, `var(--text-heading|secondary|tertiary)`; `Dialog` from `@/components/ui/dialog`; lucide icons.
- Status values: `pending | done | billed | paid`. Line kinds: `material | labour`.

## File map

| File | Responsibility |
|---|---|
| `src/lib/db/schema.ts` (append) | 7 civil tables + 2 enums |
| `drizzle/0020_civil_management.sql`, `drizzle/meta/_journal.json` | migration |
| `src/types/civil.ts` | Zod schemas + TS types shared client/server |
| `src/lib/civil/status.ts` | `planStatusChange()` — transition rules |
| `src/lib/civil/totals.ts` | `sumLines()` |
| `src/lib/civil/import-parser.ts` | `parseCivilWorkbook()` — xlsx → parsed jobs |
| `src/lib/civil/job-number.ts` | `nextJobNo()` |
| `src/lib/auth/index.ts` | add `ROLES.CIVIL` |
| `src/lib/nav-items.ts`, `src/lib/status-maps.ts` | nav group, `CIVIL_JOB_STATUS_MAP` |
| `src/app/api/v1/civil/**` | companies, cities, branches, managers, jobs, jobs/[id], jobs/[id]/status, jobs/bulk-status, suggestions, summary, export, import/preview, import/commit |
| `src/components/civil/*` | shared UI: `CivilStatusBadge`, `JobEditor`, `BranchDialog`, `CompanyDialog`, `ManagersDialog`, `StatusActionDialog` |
| `src/app/(dashboard)/civil/**` | pages: home, companies/[id], branches/[id], jobs, jobs/new, jobs/[id], import |
| `tests/civil-*.test.ts` | unit tests for lib/civil |

## Tasks

### Task 1: Schema + migration
- [ ] Append enums `civil_job_status`, `civil_line_kind` and tables per spec to `schema.ts`.
- [ ] Write `drizzle/0020_civil_management.sql` (CREATE TYPE/TABLE/INDEX, `IF NOT EXISTS` where possible), add journal idx 7 tag `0020_civil_management`.
- [ ] Apply with owner connection; verify `\dt civil_*` lists 7 tables and app role can `SELECT/INSERT` (grants via default privileges from 0003 — verify).
- [ ] `pnpm type-check` passes.

### Task 2: Pure logic + tests (TDD)
- Produces:
  - `sumLines(lines: {kind: LineKind; amountPaise: number}[]): {materialPaise; labourPaise; totalPaise}`
  - `planStatusChange(job: {status; billNo; billDate; paidDate}, to: JobStatus, input: {billNo?; billDate?; paidDate?}): {ok: true; patch: {status; billNo; billDate; paidDate}} | {ok: false; error: string}`
  - `parseCivilWorkbook(buf: ArrayBuffer): {sheetName: string; jobs: ParsedJob[]; storeNames: string[]; managerNames: string[]}`
    with `ParsedJob = {jobNo; jobDate: string|null; storeName; heading; lines: {description; kind; amountPaise}[]; remark; managerName; billNo; billDate; statedTotalPaise: number|null; mismatch: boolean}`
- [ ] Write failing tests `tests/civil-status.test.ts`, `tests/civil-totals.test.ts`, `tests/civil-import-parser.test.ts` (build workbook in-test with `XLSX.utils.aoa_to_sheet` reproducing the photo's rows 188–192).
- [ ] Implement; `pnpm vitest run tests/civil-*` passes.

### Task 3: API
- [ ] `ROLES.CIVIL`; routes listed in file map, each: auth → role (mutations) → Zod (422) → tenant-scoped queries.
- [ ] Jobs POST/PATCH write job + lines in one transaction, `totalPaise = sumLines().totalPaise`, `jobNo = nextJobNo()` with retry on unique violation.
- [ ] Status route uses `planStatusChange`, inserts `civil_job_events` row.
- [ ] `pnpm vitest run tests/tenant-isolation.test.ts tests/role-enforcement.test.ts` passes.

### Task 4: UI
- [ ] Nav group "Civil" (Companies `/civil`, All Jobs `/civil/jobs`, Import `/civil/import`).
- [ ] Pages per spec screens 1–6 with shared components.
- [ ] `pnpm type-check && pnpm lint` clean for new files.

### Task 5: Verify in browser
- [ ] Create company, city, branch, manager; create job with 5 lines; mark done/billed/paid; check KPIs; filters; export; import a generated sample workbook.
