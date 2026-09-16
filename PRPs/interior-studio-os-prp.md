# PRP: Interior Studio OS

> Implementation blueprint for parallel agent execution
> Built by **DigitalVetri** for **The Interior Studio**

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | The Interior Studio OS |
| **Type** | Multi-tenant SaaS — WhatsApp-first CRM + PM + ERP + AI |
| **Version** | 1.0 |
| **Created** | 2026-07-22 |
| **Complexity** | High |
| **Reference** | BUILD_GUIDE.md (source of truth) |

> **Stack divergence note:** This project uses **Next.js 15 + Supabase + Drizzle ORM + Inngest**, NOT the scaffold default (FastAPI + React + Alembic). All agents must follow BUILD_GUIDE.md stack decisions — do not re-litigate.

---

## SCAFFOLD STATUS (as of 2026-07-22)

**App root:** `C:\interior-ulagam\interior-studio-os\`

Already completed — agents MUST NOT redo:
- [x] `pnpm create next-app@latest` scaffold (Next.js 16.2.x, TypeScript, Tailwind v4, App Router, `src/` dir, `@/*` alias)
- [x] All project dependencies installed (`pnpm install` — clean, 849 packages)
- [x] shadcn peer deps: `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`
- [x] `components.json` created (Radix UI / default style / cssVariables / neutral base)
- [x] `src/lib/utils.ts` created with `cn()` and `formatRupees()` helpers
- [x] `pnpm-workspace.yaml` configured (native build scripts allowed)
- [x] `.env.example` created with all 17 variables
- [x] `pnpm build` passes cleanly (TypeScript + static page generation)

Agents START here — these are the remaining Phase 0 tasks:
- [ ] `src/lib/db/schema.ts` — Drizzle schema (all 20 tables)
- [ ] `drizzle/` migrations via `drizzle-kit generate`
- [ ] RLS SQL policies for all tenant-scoped tables
- [ ] `src/lib/supabase/` — server + browser clients (SSR-safe)
- [ ] `src/lib/auth/` — role checks, tenant context extraction
- [ ] `src/app/api/health/route.ts`
- [ ] `src/app/api/webhooks/whatsapp/route.ts` (GET verify + POST stub)
- [ ] `src/app/api/inngest/route.ts` + `src/inngest/client.ts` + hello-world function
- [ ] `src/app/(dashboard)/layout.tsx` — sidebar + TopBar
- [ ] `src/app/(dashboard)/dashboard/page.tsx` — empty-state KPI grid
- [ ] `src/app/login/page.tsx` — Supabase Auth login

---

## PRODUCT OVERVIEW

**Description:** One operating system that carries an interior design project from the first Instagram DM to the final handover sign-off, tracking every rupee of margin in between. Four layers over one shared Supabase Postgres database: CRM, Project Management, ERP, and AI Automation.

**Value Proposition:** WhatsApp is the client portal (no logins), margin is a first-class real-time number per line/room/project, and the AI layer is invisible — supervisors send photos and voice notes; the system does the structuring.

**Three differentiators to protect:**
1. WhatsApp is the client portal — clients approve, pay, see updates in chat. No logins.
2. Margin is first-class and real-time — client rate vs procurement rate per line/room/project.
3. AI layer is invisible — photo + voice note in, structured data out.

**MVP Scope (Phase 0 + Phase 1):**
- [ ] Supabase Auth + multi-tenant RLS schema (all 20 tables)
- [ ] App shell: Next.js dashboard layout, nav, shadcn/ui theme
- [ ] Inngest wired with hello-world + WABA webhook verify handshake
- [ ] Lead pipeline board (drag-between-stages)
- [ ] Site Visit Scheduler via WhatsApp Flow + photo/voice capture
- [ ] Requirement Capture (structured, room-wise)
- [ ] Quotation Builder — room-wise lines with live margin, branded PDF, WhatsApp send + approval
- [ ] Follow-up nudge automation (3/7/14-day, auto-cancel on reply)

**Full Scope (Phase 2 + Phase 3 — build after MVP validated):**
- [ ] Project lifecycle with stage gates
- [ ] Deliverables tracker with revision meter + change-order quotes
- [ ] Milestone → GST invoice → Razorpay link → webhook reconciliation
- [ ] Daily site execution tracker (AI-parsed 6pm WhatsApp prompt)
- [ ] Snag list / handover + client WhatsApp sign-off
- [ ] BOQ & margin engine (quoted-vs-actual, vendor rate-creep alerts)
- [ ] PO & GRN with photo proof
- [ ] Material Library with price history
- [ ] GST accounts (HSN/SAC, CGST/SGST/IGST, Tally export, e-invoice toggle)
- [ ] Expenses (AI-parsed WhatsApp logging)
- [ ] AI site-log parsing (Gemini Flash for photos, Whisper for Tanglish voice)
- [ ] Monday Owner Brief (Groq — risk/receivables/workload/margin)
- [ ] AI quote drafting from requirement brief + material library
- [ ] Client Trust Timeline (magic-link page, curated photos, milestone progress)
- [ ] Referral engine (post-handover NPS → Google review + referral tracking)

---

## TECH STACK

| Layer | Technology | Notes |
|-------|------------|-------|
| Language | TypeScript 5.x (strict) | No `any` without `// reason:` comment |
| Framework | Next.js 15 (App Router) | Server Components first; client only for interactivity |
| Runtime/Host | Vercel | Preview per PR, prod on `main` |
| Database | Supabase Postgres + RLS | Multi-tenant isolation via Row-Level Security |
| ORM | Drizzle ORM | SQL-first; `src/lib/db/schema.ts` |
| Auth | Supabase Auth | Office roles: owner/designer/supervisor/accountant |
| Background Jobs | Inngest | Event + cron + durable steps; `src/inngest/functions/` |
| WhatsApp | Meta WhatsApp Cloud API (Graph API v21+) | Direct, no BSP |
| Payments | Razorpay (Payment Links + webhooks) | Abstracted via `lib/payments/` |
| PDF | Playwright headless Chromium (BOQ/invoices) + `@react-pdf/renderer` (receipts) | Background Inngest job |
| AI — text/voice | Groq (120B/20B + Whisper v3 Turbo) | Via `lib/ai/` abstraction |
| AI — vision | Gemini Flash | Via same `lib/ai/` abstraction |
| UI | Tailwind CSS + shadcn/ui | `pnpm dlx shadcn@latest init` |
| Data fetching | TanStack Query | PWA offline outbox via IndexedDB |
| Validation | Zod | Shared client/server schemas in `src/types/` |
| Mobile (field) | PWA (installable, offline outbox) | WhatsApp-first; service worker |
| e-Sign | Click-approval + audit trail (Aadhaar eSign via Digio/Leegality later) | |
| Testing | Vitest (unit) + Playwright (E2E) | 80%+ coverage on money-critical paths |
| Money | **All amounts in paise (integers), never floats** | Format only at display layer |

---

## DATABASE MODELS

All tables live in `src/lib/db/schema.ts` (Drizzle definitions). Every tenant-scoped table carries `tenant_id` with RLS policy pattern:

```sql
alter table <table> enable row level security;
create policy tenant_isolation on <table>
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

> Inngest functions use the **service role key** (bypasses RLS) and must set `tenant_id` explicitly on every query.

### tenants
`id, name, gstin, branding_json, wa_config (phone_number_id, access_token, verify_token), tally_settings, created_at`

### users
`id, tenant_id, supabase_uid, role (owner|designer|supervisor|accountant), full_name, phone, created_at`
- Office roles have Supabase Auth; supervisors/vendors identified by phone number

### leads
`id, tenant_id, source (instagram|whatsapp|referral|website|walk_in), stage (new|site_visit_scheduled|consultation_done|proposal_sent|negotiation|won|lost), owner_id, contact_name, contact_phone, budget_band, lost_reason, notes, first_touch_at, last_activity_at, created_at`
- Stage enum enforced at DB level
- Stale flag: >5 days in same stage

### site_visits
`id, tenant_id, lead_id, designer_id, scheduled_at, completed_at, location_json, photos (text[]), measurements_json, voice_notes (text[]), notes, created_at`
- Booked via WhatsApp Flow

### requirements
`id, tenant_id, lead_id, rooms_json, style_tags (text[]), budget_band, moodboard_urls (text[]), total_area_sqft, notes, created_at`
- Structured; seeds AI quote draft

### projects
`id, tenant_id, lead_id, client_id (→ users), lifecycle_stage (design_pending|design_in_progress|design_approved|procurement|execution|snagging|handover|complete), timeline_json, started_at, expected_end_at, created_at`
- Stage gates: Procurement cannot open until design approved + milestone 2 paid

### quotes
`id, tenant_id, project_id, version (integer, starts 1), status (draft|sent|approved|rejected|superseded), pdf_url, sent_at, approved_at, approval_audit_json, wa_message_id, created_by, created_at`

### quote_lines
`id, quote_id, room, item, description, qty, unit, client_rate_paise, cost_rate_paise, margin_paise (generated: (client_rate − cost_rate) × qty), hsn_sac, material_id (nullable), created_at`
- **margin_paise = (client_rate_paise − cost_rate_paise) × qty** — enforced by DB generated column

### deliverables
`id, project_id, type (2d_plan|3d_render|color_palette|working_drawings|bom), status (pending|in_progress|in_review|approved|rejected), revision_count, revision_cap, latest_file_url, approved_at, created_at`
- When revision_count > revision_cap → trigger change-order quote

### milestones
`id, project_id, label, pct_of_total, amount_paise, trigger_stage, invoice_id, payment_status (pending|link_sent|paid|overdue), paid_at, razorpay_link_id, created_at`
- Default: 10/40/40/10 split
- Overdue escalation: day 3 → client nudge; day 7 → client nudge 2; day 10 → owner alert

### site_logs
`id, tenant_id, project_id, log_date (date), photos (text[]), voice_note_url, transcript, progress_pct, stage, delay_flag (boolean), labour_count, blockers_json, ai_parsed_json, source (whatsapp|manual), created_at`
- One per active site per day; fed by 6pm WhatsApp cron

### purchase_orders
`id, tenant_id, project_id, vendor_id (→ users or vendor table), po_number, lines_json, status (draft|sent|acknowledged|partial|complete|cancelled), advance_paid_paise, expected_delivery_at, pdf_url, wa_message_id, created_at`

### grns
`id, tenant_id, po_id, line_id, delivered_qty, photo_proof (text[]), received_at, notes, created_at`
- Goods receipt; compared against PO lines

### materials
`id, tenant_id, category (laminate|hardware|furniture|fabric|lighting|flooring|sanitary|other), name, brand, vendor_id, unit, current_rate_paise, last_purchase_price_paise, price_history_json, hsn_sac, notes, created_at`
- Price change alerts on active quotes

### invoices
`id, tenant_id, project_id, milestone_id, invoice_number, invoice_date (date), hsn_sac_lines_json, subtotal_paise, cgst_paise, sgst_paise, igst_paise, place_of_supply (state code), is_interstate (boolean), irn (nullable — e-invoice), qr_code_url, pdf_url, created_at`
- Works-contract 18% GST handling
- e-invoice toggle via IRN/QR from GSP

### payments
`id, tenant_id, invoice_id, razorpay_link_id, razorpay_payment_id (unique — for idempotency), amount_paise, status (pending|captured|failed|refunded|partial), reconciled_at, manual_override_by, manual_override_note, created_at`
- **IRON RULE: status written ONLY by Razorpay webhook — never by UI**

### expenses
`id, tenant_id, project_id, category (petty_cash|transport|labour|material|other), amount_paise, description, receipt_url, logged_by (user_id), logged_via (whatsapp|manual), approved_by, approved_at, created_at`

### snag_items
`id, project_id, description, photo_url, assignee_id (→ users), status (open|in_progress|resolved|client_confirmed), client_confirmed_at, wa_message_id, created_at`

### wa_messages
`id, tenant_id, thread_id (client phone), direction (inbound|outbound), message_id (meta id), category (utility|marketing|service), template_name, body_preview, flow_response_json, cost_paise, created_at`
- Full audit trail + cost tracking

---

## MODULES

### Module 0: Foundation
**Agents:** DATABASE-AGENT + BACKEND-AGENT + DEVOPS-AGENT (parallel)

**Tasks:**
- Drizzle schema for all 20 tables in `src/lib/db/schema.ts`
- RLS policies for all tenant-scoped tables
- Supabase Auth + tenant context (`src/lib/auth/`)
- App shell: Next.js App Router layout, sidebar nav, shadcn theme
- Inngest client + `/api/inngest` route + hello-world function
- WhatsApp webhook verify handshake (`/api/webhooks/whatsapp/route.ts`)
- Environment variable wiring (.env.example + .env.local template)

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/webhooks/whatsapp` | Meta verify handshake (hub.challenge echo) |
| POST | `/api/webhooks/whatsapp` | Inbound messages, statuses, flow responses |
| POST | `/api/inngest` | Inngest serve endpoint |
| GET | `/api/health` | Health check |

**Pages:**
| Route | Page | Notes |
|-------|------|-------|
| `/` | Landing / redirect | Redirect to /dashboard if authed |
| `/login` | LoginPage | Supabase Auth email+password |
| `/(dashboard)/layout.tsx` | DashboardLayout | Sidebar, TopBar, tenant context |
| `/(dashboard)/dashboard` | DashboardHome | KPI widgets (empty-state OK for Phase 0) |

---

### Module 1: CRM — Lead Management
**Agents:** BACKEND-AGENT + FRONTEND-AGENT (parallel after DB done)

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/leads` | List leads (filter by stage, owner, stale) |
| POST | `/api/leads` | Create lead (capture source + contact) |
| GET | `/api/leads/[id]` | Get single lead with activity history |
| PATCH | `/api/leads/[id]` | Update stage, owner, notes |
| POST | `/api/leads/[id]/convert` | Convert won lead → project |
| GET | `/api/leads/stats` | Pipeline counts per stage |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/leads` | LeadPipelineBoard | KanbanBoard, LeadCard, StageColumn |
| `/(dashboard)/leads/[id]` | LeadDetailPage | LeadInfo, ActivityTimeline, QuickActions |
| `/(dashboard)/leads/new` | NewLeadPage | LeadForm (source, contact, budget band) |

**Business rules:**
- Single-owner-per-thread: one user owns a lead's WhatsApp thread
- Stale flag: `last_activity_at` > 5 days → highlight card red
- Lost-reason required when stage = `lost`
- Convert only when stage = `won`

---

### Module 2: CRM — Site Visit & Requirements
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/site-visits` | List visits (filter by lead, designer, date) |
| POST | `/api/site-visits` | Schedule visit + send WhatsApp confirmation |
| PATCH | `/api/site-visits/[id]` | Update; mark complete |
| POST | `/api/site-visits/[id]/complete` | Complete visit, attach photos/measurements |
| GET | `/api/requirements/[leadId]` | Get requirements for a lead |
| POST | `/api/requirements` | Create requirement brief |
| PATCH | `/api/requirements/[id]` | Update rooms/style/budget |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/site-visits` | SiteVisitList | CalendarView, VisitCard, DesignerFilter |
| `/(dashboard)/leads/[id]/requirements` | RequirementsForm | RoomBuilder, StyleTagPicker, MoodboardLinks |

**Inngest functions:**
- `site-visit.scheduled` → send T-24h reminder utility template
- `site-visit.scheduled` + sleep → send T-2h reminder utility template

---

### Module 3: CRM — Quotation Builder
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/quotes` | List quotes (filter by project, status) |
| POST | `/api/quotes` | Create quote draft |
| GET | `/api/quotes/[id]` | Get quote with lines and margin totals |
| PATCH | `/api/quotes/[id]` | Update quote metadata |
| POST | `/api/quotes/[id]/lines` | Add line item |
| PATCH | `/api/quotes/[id]/lines/[lineId]` | Update line (rates auto-recalculate margin) |
| DELETE | `/api/quotes/[id]/lines/[lineId]` | Remove line |
| POST | `/api/quotes/[id]/send` | Generate PDF + send via WhatsApp |
| POST | `/api/quotes/[id]/approve` | Record client approval (click-trail audit) |
| POST | `/api/quotes/[id]/revise` | Create V+1 quote, mark current as superseded |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/quotes` | QuoteListPage | QuoteTable, StatusBadge |
| `/(dashboard)/quotes/[id]` | QuoteBuilderPage | RoomLineEditor, MarginBar, QuoteSummary, PDFPreview |
| `/(dashboard)/quotes/[id]/preview` | QuotePDFPreview | Branded PDF iframe |

**Business rules:**
- `margin_paise = (client_rate_paise − cost_rate_paise) × qty` — never editable directly
- Margin shown per line, per room, and project total while typing
- Approved quote cannot be edited — must revise (new version)
- PDF generated by Inngest background job (headless Chromium)

**Inngest functions:**
- `quote.send-pdf` → generate PDF → upload to Supabase Storage → send WhatsApp template with link + Approve/Discuss buttons

---

### Module 4: CRM — Follow-up Automation
**Agents:** BACKEND-AGENT (Inngest functions only)

**Inngest functions:**
```
quote.sent (event)
  → sleep 3d → check no reply → send nudge 1 (Tanglish utility template)
  → sleep 4d → check no reply → send nudge 2
  → sleep 7d → check no reply → send final nudge
  (any inbound reply → cancelOn cancels the run)
```

**WhatsApp templates to register:**
- `follow_up_nudge_1` (utility): "Hi {{name}}, just checking in on your interior project quote…"
- `follow_up_nudge_2` (utility): gentle Tanglish follow-up
- `follow_up_final` (marketing): final offer / close

---

### Module 5: Project Management — Lifecycle & Deliverables
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects` | List projects (filter by stage, designer) |
| GET | `/api/projects/[id]` | Project detail with milestones, deliverables |
| PATCH | `/api/projects/[id]/stage` | Advance lifecycle stage (gate-checked) |
| GET | `/api/projects/[id]/deliverables` | List deliverables |
| POST | `/api/projects/[id]/deliverables` | Create deliverable |
| PATCH | `/api/deliverables/[id]` | Update status; increment revision_count |
| POST | `/api/deliverables/[id]/approve` | Client approval (may come via WhatsApp webhook) |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/projects` | ProjectListPage | ProjectTable, StageFilter |
| `/(dashboard)/projects/[id]` | ProjectDashboard | LifecycleProgress, DeliverablesTracker, MilestoneSummary |
| `/(dashboard)/projects/[id]/deliverables` | DeliverablesPage | DeliverableCard, RevisionMeter, UploadZone |

**Business rules:**
- Stage gate: Procurement cannot open unless design approved AND milestone 2 paid
- Revision meter: free_revisions configurable (default 2); revision N+1 triggers change-order quote flow
- Deliverable upload → notify designer via WhatsApp

---

### Module 6: ERP — Milestone Payments
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/[id]/milestones` | List milestones with payment status |
| POST | `/api/projects/[id]/milestones` | Create milestone (or seed defaults) |
| POST | `/api/milestones/[id]/trigger` | Trigger invoice + payment link flow |
| POST | `/api/webhooks/razorpay` | Payment captured / failed events |
| POST | `/api/milestones/[id]/override` | Manual override (writes audit row) |
| GET | `/api/payments` | Payment list with reconciliation status |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/projects/[id]/payments` | MilestonePaymentsPage | MilestoneTimeline, PaymentStatusBadge, OverrideModal |
| `/(dashboard)/accounts` | AccountsDashboard | ReceivablesSummary, ProjectPnL |

**Inngest function (critical path):**
```
milestone.reached
  → generate GST invoice PDF (lib/pdf)
  → create Razorpay payment link (lib/payments)
  → send WhatsApp utility template with link
  → [waitForEvent] razorpay.payment.captured
  → mark milestone paid + reconcile invoice
  → send receipt template
  → unlock next project stage
  → refresh P&L + receivables
  → [if overdue] escalation ladder (day 3/7 client, day 10 owner)
```

**Iron rules:**
- `payments.status` written ONLY by webhook — never by UI
- Idempotency: deduplicate by `razorpay_payment_id`
- Manual override must write an `audit_overrides` row

---

### Module 7: ERP — Site Execution Tracker
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects/[id]/site-logs` | List site logs (date range) |
| POST | `/api/site-logs` | Manual log entry |
| GET | `/api/site-logs/[id]` | Single log with AI-parsed JSON |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/projects/[id]/site` | SiteExecutionPage | RoomWorkBoard, ProgressTimeline, DelayFlags |
| `/(field)/site-log` | FieldSiteLogPWA | Photo upload, progress slider, blocker notes |

**Inngest function:**
```
cron: 18:00 per active site
  → send WhatsApp Flow prompt to supervisor
  → [inbound webhook] media received
  → download media IMMEDIATELY (URLs expire ~5min)
  → store in Supabase Storage
  → Whisper transcribes Tanglish voice note
  → LLM extracts { stage, progress_pct, blockers, labour_count } as JSON
  → write site_log, raise delay_flag if progress_pct < expected
  → feed Monday brief queue
```

---

### Module 8: ERP — BOQ, PO & Materials
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/materials` | Material library (filter by category, vendor) |
| POST | `/api/materials` | Add material |
| PATCH | `/api/materials/[id]` | Update rate (pushes to price_history_json) |
| GET | `/api/purchase-orders` | List POs (filter by project, status) |
| POST | `/api/purchase-orders` | Create PO + generate PDF + send to vendor |
| PATCH | `/api/purchase-orders/[id]` | Update PO status |
| POST | `/api/purchase-orders/[id]/grn` | Record goods receipt |
| GET | `/api/projects/[id]/boq` | BOQ with quoted-vs-actual margin comparison |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/materials` | MaterialLibraryPage | MaterialTable, PriceHistoryChart |
| `/(dashboard)/purchase-orders` | POListPage | POTable, StatusFilter |
| `/(dashboard)/purchase-orders/[id]` | PODetailPage | LineItems, GRNLog, DeliveryStatus |
| `/(dashboard)/projects/[id]/boq` | BOQPage | MarginComparison, VendorRateAlerts |

**Business rules:**
- Material rate change on active quote → alert the quote owner
- GRN delivered_qty compared to PO lines → flag discrepancies
- Vendor advance tracked vs total PO value

---

### Module 9: ERP — GST Accounts & Expenses
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/invoices` | Invoice list |
| GET | `/api/invoices/[id]` | Invoice detail + PDF |
| GET | `/api/projects/[id]/pnl` | Project P&L summary |
| GET | `/api/accounts/receivables` | All receivables dashboard |
| GET | `/api/accounts/tally-export` | Tally-compatible CSV export |
| POST | `/api/expenses` | Log expense |
| GET | `/api/projects/[id]/expenses` | Expense list |

**Pages:**
| Route | Page | Components |
|-------|------|------------|
| `/(dashboard)/accounts` | AccountsDashboard | ReceivablesTable, ProjectPnLTable, TallyExportBtn |
| `/(dashboard)/projects/[id]/expenses` | ExpensesPage | ExpenseLogForm, ExpenseTable, CategoryBreakdown |

**GST rules:**
- Works contract: 18% GST (9% CGST + 9% SGST intra-state; 18% IGST inter-state)
- Place of supply determines CGST+SGST vs IGST
- e-Invoice toggle: generate IRN/QR via GSP API when enabled

---

### Module 10: AI Layer
**Agents:** BACKEND-AGENT (lib/ai/ + Inngest functions)

**`src/lib/ai/index.ts` interface:**
```typescript
export interface AIProvider {
  chatJSON<T>(opts: { system: string; user: string; schema: ZodType<T> }): Promise<T>;
  transcribe(audioUrl: string): Promise<string>;           // Groq Whisper v3 Turbo
  describeImage(imageUrl: string, prompt: string): Promise<string>; // Gemini Flash
}
```

**Routing:**
- Text/JSON/quote-draft/owner-brief → Groq 120B (heavy) or 20B (cheap parsing)
- Voice (Tanglish site notes) → Groq Whisper v3 Turbo
- Site photos → Gemini Flash

**Inngest functions:**
- `ai.monday-brief` (cron 08:00 Mon) → aggregate all tenant projects at risk, receivables, designer workload, margin movers → Groq → WhatsApp + dashboard widget
- `ai.quote-draft` (triggered from requirements) → pull requirement brief + material library + past BOQs → Groq → draft quote lines for human review/approval
- `ai.expense-parse` → inbound WhatsApp voice/text from supervisor → LLM extracts { category, amount, description }

**Hard rules:**
- Always validate LLM output with Zod
- Always keep human-in-the-loop approval before any client-facing quote or invoice
- Use Groq Batch API (50% off) for the all-tenant Monday-brief run
- Never import groq-sdk or @google/generative-ai directly from a feature — always go through `lib/ai/`

---

### Module 11: Client Trust Timeline + Snag/Handover
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/p/[token]` (page) | Magic-link client project page (no auth) |
| GET | `/api/client-token/[token]` | Validate token + return project snapshot |
| POST | `/api/projects/[id]/snag-items` | Create snag item |
| PATCH | `/api/snag-items/[id]` | Update status |
| POST | `/api/projects/[id]/handover` | Trigger handover flow (final invoice + warranty) |

**Pages:**
| Route | Page | Notes |
|-------|------|-------|
| `/p/[token]` | ClientTrustTimeline | Public, no login; curated photos, milestone progress, team |
| `/(dashboard)/projects/[id]/snag` | SnagListPage | Photo punch list; client sign-off via WhatsApp |

---

### Module 12: Referral Engine
**Agents:** BACKEND-AGENT (Inngest functions)

**Inngest function:**
```
project.handover_complete
  → sleep 7d
  → send NPS ping on WhatsApp
  → [if positive response] send Google review link + referral ask
  → log referral source on any new lead with matching referrer phone
```

---

## INTEGRATION FLOWS (Inngest — durable steps)

Reference: BUILD_GUIDE.md §9. Implement as files in `src/inngest/functions/`.

| Function file | Trigger | Description |
|--------------|---------|-------------|
| `milestone-payment.ts` | `milestone.reached` | Invoice → Razorpay link → WhatsApp → webhook reconcile → stage unlock |
| `site-intelligence.ts` | `cron 18:00` per active site | Prompt → media download → Whisper → LLM parse → site_log write |
| `follow-up-nudge.ts` | `quote.sent` | 3/7/14-day nudge with `cancelOn` inbound reply |
| `monday-brief.ts` | `cron 08:00 Mon` | AI risk/receivables brief → WhatsApp owner |
| `quote-pdf.ts` | `quote.send_requested` | Headless Chromium PDF → Storage → WhatsApp send |
| `po-send.ts` | `po.created` | PO PDF → WhatsApp to vendor |
| `site-visit-reminders.ts` | `site_visit.scheduled` | T-24h + T-2h utility templates |
| `overdue-escalation.ts` | `cron daily` | Check overdue milestones → escalation ladder |
| `ai-quote-draft.ts` | `requirements.completed` | AI draft from brief + library |
| `handover-referral.ts` | `project.handover_complete` | NPS → Google review + referral ask |

---

## WHATSAPP TEMPLATES TO REGISTER

| Template name | Category | Variables |
|--------------|----------|-----------|
| `site_visit_confirmed` | utility | name, date, time, designer_name |
| `site_visit_reminder_24h` | utility | name, date, time |
| `site_visit_reminder_2h` | utility | name, time |
| `quote_ready` | utility | name, quote_url, approve_button |
| `follow_up_nudge_1` | utility | name |
| `follow_up_nudge_2` | utility | name |
| `follow_up_final` | marketing | name |
| `milestone_payment_request` | utility | name, milestone_label, amount, payment_link |
| `payment_receipt` | utility | name, amount, invoice_number |
| `site_daily_prompt` | utility | supervisor_name, project_name |
| `snag_resolved` | utility | client_name, item_description |
| `handover_complete` | utility | client_name, project_name |
| `monday_brief` | utility | owner_name (body is full brief) |
| `po_sent_to_vendor` | utility | vendor_name, po_number, total |
| `nps_ping` | marketing | client_name, project_name |

> Submit templates early — approval is minutes to 24h but recategorization means a rewrite cycle. Write utility templates transactionally so Meta doesn't recategorize them as marketing.

---

## PHASE EXECUTION PLAN

### Phase 0: Foundation (4 agents in parallel)
**DATABASE-AGENT:**
- `src/lib/db/schema.ts` — all 20 Drizzle table definitions
- `drizzle/` — initial migration via `drizzle-kit generate`
- RLS SQL policies for all tenant-scoped tables
- Supabase seed script for test tenant + users

**BACKEND-AGENT:**
- `src/lib/auth/` — role checks, tenant context extraction from Supabase JWT
- `src/lib/supabase/` — server + client helpers (SSR-safe)
- `src/app/api/health/route.ts`
- `src/app/api/webhooks/whatsapp/route.ts` — GET verify + POST stub
- `src/app/api/inngest/route.ts` — Inngest serve
- `src/inngest/client.ts` + hello-world function
- `.env.example` with all 15 variables

**FRONTEND-AGENT:**
- `pnpm create next-app` scaffold already done; wire shadcn + Tailwind theme
- `src/app/(dashboard)/layout.tsx` — sidebar (leads, projects, quotes, materials, accounts, settings) + TopBar with tenant switcher
- `src/app/(dashboard)/dashboard/page.tsx` — empty-state KPI grid (4 cards)
- Auth pages: `/login`, `/register` using Supabase Auth

**DEVOPS-AGENT:**
- `vercel.json` with function config
- `.github/workflows/ci.yml` — lint, type-check, vitest, drizzle-kit check
- Branch protection rules documented

**Validation Gate 0:**
```bash
pnpm drizzle-kit push       # schema applies clean
pnpm dev                    # compiles + server on :3000
pnpm inngest-cli dev        # Inngest dev server connects
curl localhost:3000/api/health  # 200 OK
# WhatsApp webhook verify: GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=abc → abc
```

---

### Phase 1: CRM (3 backend+frontend pairs in parallel)
**Pair A:** Lead Management (Module 1) — lead CRUD + pipeline board
**Pair B:** Site Visit + Requirements (Module 2) — scheduler + requirement form
**Pair C:** Quotation Builder (Module 3) — line editor + margin + PDF + WhatsApp send

**Validation Gate 1:**
```bash
pnpm type-check              # zero errors
pnpm lint                    # zero warnings
pnpm vitest run              # margin math unit tests pass
# Manual: create lead → schedule visit → add requirements → build quote with margin → generate PDF → send WhatsApp approval
```

---

### Phase 2: Project Management + ERP (modules in parallel where independent)
**Group A (parallel):**
- Module 5: Lifecycle + Deliverables
- Module 8: BOQ + Materials + PO/GRN

**Group B (after Group A):**
- Module 6: Milestone Payments (needs lifecycle)
- Module 9: GST Accounts + Expenses

**Group C (after Module 6):**
- Module 7: Site Execution Tracker

**Validation Gate 2:**
```bash
pnpm vitest run              # GST tax-split tests, payment state machine tests
pnpm playwright test         # E2E: lead → quote → approve → project → milestone → paid
# Manual: verify a test-mode Razorpay payment auto-reconciles without touching payment status in UI
```

---

### Phase 3: AI + Polish (2 agents parallel, then review)
**BACKEND-AGENT:** Modules 10 (AI layer) + 12 (Referral)
**FRONTEND-AGENT:** Module 11 (Trust Timeline + Snag) + owner dashboards + KPI polish

**Validation Gate 3:**
```bash
pnpm vitest run --coverage   # ≥80% on lib/ai/, lib/payments/, lib/pdf/
# Manual: supervisor sends WhatsApp voice note → Whisper transcribes → LLM parses → site_log written
# Manual: Monday owner brief generates + sends at 08:00
```

---

### Phase 4: Quality (3 agents in parallel)
**TEST-AGENT:**
- Vitest: margin engine, GST splits, payment state machine, AI output Zod validators
- Playwright E2E: full journey lead → quote → approve → project → milestone → paid
- PWA offline test: airplane-mode a mutation, reconnect, confirm IndexedDB sync

**REVIEW-AGENT:**
- Security audit: RLS policy coverage, webhook signature verification, no secrets client-side
- OWASP: SQL injection (Drizzle parameterized), XSS (Next.js escaping), CSRF (Next.js headers)
- Performance: server components audit, TanStack Query cache config

**DEVOPS-AGENT:**
- Vercel production deploy + env vars
- Inngest production signing key registration
- Razorpay + Meta production webhook URL registration
- Per-studio cost projection documentation

**Final Validation:**
```bash
pnpm build                  # Next.js production build passes
pnpm vitest run --coverage  # ≥80% coverage
pnpm playwright test        # all journeys green
curl https://[vercel-url]/api/health   # 200 OK in production
```

---

## VALIDATION GATES SUMMARY

| Gate | Commands | Blocks |
|------|----------|--------|
| **0 — Foundation** | `drizzle-kit push`, `pnpm dev`, `curl /api/health`, WhatsApp verify handshake | Phase 1 start |
| **1 — CRM** | `pnpm type-check`, `pnpm lint`, `vitest` (margin tests), manual quote→PDF→WhatsApp flow | Phase 2 start |
| **2 — ERP** | `vitest` (GST + payment tests), Playwright E2E, Razorpay test-mode reconciliation | Phase 3 start |
| **3 — AI** | `vitest --coverage ≥80%`, WhatsApp voice→site_log manual, Monday brief manual | Phase 4 start |
| **Final** | `pnpm build`, full test suite, all journeys green, prod health check | Ship |

---

## ENVIRONMENT VARIABLES

```dotenv
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only — bypasses RLS; treat like a password
DATABASE_URL=                   # postgres connection string for Drizzle

# --- WhatsApp Cloud API ---
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=          # System User token (long-lived)
WHATSAPP_VERIFY_TOKEN=          # you invent this; used for webhook handshake
WHATSAPP_APP_SECRET=            # to verify inbound webhook X-Hub-Signature-256

# --- Razorpay ---
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# --- AI ---
GROQ_API_KEY=
GOOGLE_AI_API_KEY=              # Gemini Flash

# --- Inngest ---
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## CODING STANDARDS (from BUILD_GUIDE.md §13)

1. **TypeScript strict** everywhere — no `any` without `// reason:` comment
2. **Zod schemas are the contract** — define once in `src/types/`, use for API validation and inferred TS types
3. **Server-first** — data fetching in Server Components / route handlers; client components only for interactivity
4. **Every DB query is tenant-scoped** — filter by `tenant_id` in app code; pass explicitly in jobs
5. **Money is integers (paise), never floats** — format only at display
6. **No secrets client-side** — anything without `NEXT_PUBLIC_` stays server-only
7. **Conventional Commits** (`feat:`, `fix:`, `chore:`) + PRs; branch protection on `main`
8. **Feature folders** — colocate component, query, and types per feature

---

## AGENT ASSIGNMENTS SUMMARY

| Agent | Owns |
|-------|------|
| **DATABASE-AGENT** | `src/lib/db/schema.ts`, all 20 tables, RLS policies, Drizzle migrations, Supabase seed |
| **BACKEND-AGENT** | All `/api/*` route handlers, `src/lib/` (auth, whatsapp, payments, ai, pdf), Inngest functions |
| **FRONTEND-AGENT** | All `src/app/(dashboard)/` pages, `src/app/(field)/`, `src/app/p/[token]/`, components, TanStack Query hooks |
| **DEVOPS-AGENT** | `vercel.json`, `.github/workflows/`, env wiring, Inngest + webhook URL registration |
| **TEST-AGENT** | `tests/` Vitest unit + Playwright E2E; PWA offline sync test |
| **REVIEW-AGENT** | Security audit (RLS coverage, webhook sigs, OWASP), performance (server components, cache) |

---

## RISKS TO MONITOR

| Risk | Mitigation |
|------|-----------|
| WhatsApp template recategorization | Write utility templates transactionally; submit early |
| Groq model deprecations | AI abstraction in `lib/ai/index.ts` — swap provider in one file |
| Field adoption | WhatsApp-first; accept voice notes; PWA offline support |
| Payment webhook edge cases | Idempotency by `razorpay_payment_id`; reconciliation report; manual override with audit trail |
| GST rule changes | e-Invoice as a toggle; HSN/SAC configurable |
| Messy rate-data migration | Phase 1 cleanup sprint: seed real material rates from day 1 |
| Media URL expiry (~5min) | Download in first Inngest step immediately on webhook receipt |
| RLS bypass in jobs | Service role key — every Inngest function must set `tenant_id` explicitly |

---

## NEXT STEP

```
/execute-prp PRPs/interior-studio-os-prp.md
```

Start with **Phase 0** — dispatch DATABASE-AGENT, BACKEND-AGENT, DEVOPS-AGENT, FRONTEND-AGENT in parallel. Do not proceed to Phase 1 until Gate 0 passes (schema applies clean, health check responds, WhatsApp verify handshake works).
