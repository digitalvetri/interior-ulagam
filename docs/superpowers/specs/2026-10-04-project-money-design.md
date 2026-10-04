# Project Money & Client Payment Ledger — Design

**Date:** 2026-10-04 · **Status:** approved (screens mockup accepted, "proceed")

## Goal
One trustworthy set of numbers for every interior project and client: contract value,
real cost (material, contract labour, staff labour, other), profit, outstanding, duration —
and a running payment ledger per client with record-payment, adjustments and statements.

## Decisions (from the owner)
| Topic | Decision |
|---|---|
| Contract value | Typed manually, **excluding GST**; extra work added as "additions" |
| GST | Per-project rate (18 default / 12 / 5 / 0), added on top; never profit |
| Client owes (ledger debit) | **Milestones when they fall due** (stage reached or due date) |
| Labour | Contractor/daily-wage = labour expenses; salaried staff = **days logged per project** × salary ÷ 26 |
| Profit visibility | **Owner only** (accountant sees billing, receipts, costs) |
| Payment allocation | Oldest due milestone first, changeable |

## Single engine — `src/lib/project-money/`
Pure functions (unit-tested) + one loader per scope. Every screen reads from it.

- **Revised contract** = `projects.total_contract_paise` (now bigint, ex-GST) + Σ `project_additions`.
- **Milestone amount** = round(pct × revised ÷ 100) for unpaid milestones (paid stay locked);
  GST = amount × project gst_pct; **total** = amount + GST.
- **Milestone falls due** when `due_on ≤ today`, or its `trigger_stage` has been reached
  (`due_since` stamped by the stage routes; reached-but-unstamped counts as due today).
- **Received per milestone** = Σ `payment_allocations`. Status: Paid / Part paid / Overdue (due & unpaid
  past due date) / Due / Upcoming.
- **Costs (ex-GST, voided excluded)**: expenses with `po_id` → amount as stored (net);
  other expenses → amount − gst_amount. Category map: material → Material; labour → Contract labour;
  transport/petty_cash/other → Other. Staff labour = Σ `staff_day_logs.cost_paise`.
  Committed = Σ max(0, PO total − billed net) for non-cancelled POs.
- **Profit so far** = revised − actual cost; **expected final** = revised − (actual + committed);
  quoted margin from latest accepted/approved quote.
- **Project received** = captured/non-pending payments where project_id = P or invoice.project_id = P.
- **Paid out** = non-PO expenses + vendor_payments on the project's POs. Cash in hand = received − paid out.
- **Duration**: started_at, expected_end_at, new `handover_at` (stamped when stage → handover/complete);
  days elapsed / left / late; time-used % vs collected % vs stage %.

## Client ledger
Entries across the client's projects (projects with customer_id = C, or lead's customer):
milestone **falls due** (debit, total incl. GST, dated due_on/due_since), **payment** (credit, received_at),
**adjustment**: discount/write-off (credit), refund (debit). Sorted by date, running balance.
Totals: contract incl. GST, due, received, outstanding, overdue.

## Data changes (migration 0024)
- `projects.total_contract_paise` → bigint; add `gst_pct smallint default 18`, `handover_at timestamptz`.
- `milestones`: add `due_on date`, `due_since date`, `sort_order int`; `amount_paise` → bigint.
- New `project_additions` (description, amount_paise bigint, added_on).
- New `payment_allocations` (payment_id, milestone_id, amount_paise bigint) — backfilled from
  payments linked through milestone.invoice_id.
- New `ledger_adjustments` (customer_id, project_id?, kind discount|refund|write_off, amount, reason, adj_date).
- New `staff_day_logs` (user_id, project_id? null=office, week_start, days numeric(3,1), day_rate_paise, cost_paise).

## Writes & roles
- Contract/GST/handover/additions/milestones editor: OWNER_ONLY.
- Record payment (POST /payments extended with auto/explicit allocations): FINANCE.
- Adjustments: OWNER_ONLY. Staff days: OWNER_ONLY (shows salary-derived rates).
- Reads: FINANCE; profit fields stripped for non-owners.
- Razorpay webhook + milestone override also write an allocation.

## Screens
1. Project → **Money** tab (cards, cost breakdown, time & progress, milestone table, actions).
2. Contract & milestones editor (dialog).
3. Client page → **Payment ledger** tab (replaces old Payments tab): totals, filters, ledger,
   Record payment, Adjustment, Download PDF/Excel, WhatsApp statement (wa.me share text — no API cost).
4. **Staff days** weekly grid (/projects/staff-days).

## Fixes included
- Project overview "Record payment" (created an empty milestone) → real payment dialog.
- Receipt PDF works for payments without an invoice and uses `receipt_number`.
- Customer summary uses the engine (no draft/void invoices, includes unlinked payments).

## Out of scope (noted)
Finance page "To Collect" still invoice/milestone-based (follow-up to switch to the engine);
credit notes/GST invoices per milestone unchanged; work_orders.actual_cost not counted (double-count risk).

## Testing
Vitest for the engine (contract, milestone amounts, due logic, allocation, cost mapping incl. gross/net,
profit, ledger balance); tenant/role guard tests; live API smoke; browser walkthrough.
