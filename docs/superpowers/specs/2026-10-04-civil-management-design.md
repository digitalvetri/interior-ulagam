# Civil Management — Design

**Date:** 2026-10-04 · **Status:** approved in brainstorming (screens mockup accepted)

## Purpose

A second division inside the app for facility-maintenance contracts (electrical,
plumbing, civil, tank cleaning, welding…) done for retail chains such as D-Mart
and Varamahalakshmi. It replaces the "ACCOUNTS" Excel workbook (sheet
"BILL NEW - SHERIFF VINU" + "PENDING WORK").

## Decisions (from the user)

| Topic | Decision |
|---|---|
| Billing | One bill per job |
| Amounts | Only the price charged (no cost/margin) |
| Headings & prices | Free typing — no rate card. App suggests previously used text. |
| Users | Office enters everything. Managers (Depak, Kishore) are names, no login. |
| Bill output | No PDF. "Mark billed" records bill no. + bill date. |
| Payments | Track paid: Pending → Done → Billed → Paid |
| Old data | Import the existing Excel sheet |

Defaults taken without an explicit answer:
- Imported jobs with a billing date → **Billed**; others → **Done**.
- Access: roles `owner` and `accountant` (office). Not designers/supervisors.
- Billed/Paid jobs lock their lines; move back to Done to edit amounts.

## Data model (new tables, all tenant-scoped, money in paise)

- `civil_companies` — name (unique per tenant, case-insensitive), gstin, address, contact_name, contact_phone, notes
- `civil_cities` — name (unique per tenant, case-insensitive). Shared by all companies.
- `civil_branches` — company_id, city_id, name (unique per company+city), address, contact_name, contact_phone
- `civil_managers` — name (unique per tenant), phone, active
- `civil_jobs` — job_no (int, unique per tenant, continues the sheet's S.No), branch_id, job_date,
  heading, remark, manager_id, status (`pending|done|billed|paid`), bill_no, bill_date, paid_date,
  total_paise (sum of lines, written by the server in the same transaction as the lines — never by the client), created_by, updated_at
- `civil_job_lines` — job_id, position, description, kind (`material|labour`), amount_paise ≥ 0
- `civil_job_events` — job_id, from_status, to_status, note, created_by, created_at (audit of status changes)

Status rules (server-enforced):
- `billed` requires bill_no and bill_date. `paid` requires paid_date (and bill info).
- Moving a job backwards clears the fields of the stages it leaves.
- Lines can only change while status is `pending` or `done`.
- Deleting a company/branch that has jobs is refused (409).

## Screens (matches the approved mockup)

1. `/civil` — KPI cards (pending jobs, done-not-billed ₹, billed-unpaid ₹, paid this month ₹) + company list; managers managed from here.
2. `/civil/companies/[id]` — branches grouped by city with pending count and unpaid ₹; add/edit branch (city pick-or-create).
3. `/civil/branches/[id]` — branch jobs, status filter chips, "+ New job".
4. `/civil/jobs/new`, `/civil/jobs/[id]` — job editor: branch, date, manager, heading (autosuggest), line grid
   (description · Material/Labour · amount) with Enter-adds-row, live Material/Labour/Total, remark, status actions
   (Mark Done / Mark Billed… / Mark Paid… / move back).
5. `/civil/jobs` — all jobs, filters (company, city, branch, manager, month, status, search), bulk "Mark done", Excel export.
6. `/civil/import` — upload .xlsx → map each store name to company/city/branch → preview with flagged jobs → confirm.

## Import parsing

A job block starts at a row whose S.NO cell is a number and runs until the next one.
Within a block: DATE, STORE NAME, MANAGER, BILLING, BILLING DATE from the block; the
text in the MATRIAL/LABOUR column is the heading; complaint-column text paired in order
with numeric MATRIAL/LABOUR amounts form lines; kind = labour if the description
mentions labour/salary/welder, else material; unpaired descriptions go to the remark;
the TOTAL column is used only to flag a mismatch. Nothing is written until Confirm.

## Testing

- Vitest: import parser (block detection, pairing, kind, mismatch flag), status-transition rules, totals.
- Existing guards: tenant-isolation and role-enforcement tests must pass for the new routes.
- Manual: drive every screen in the browser on localhost.
