# PRP: Konstdesign CRM

> Implementation blueprint for parallel agent execution — redesign in place on the existing Interior OS repo

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | Konstdesign CRM |
| **Client** | Konst Design, Coimbatore — CEO Mohammed Sheriff |
| **Type** | Single-tenant Studio ERP / CRM |
| **Version** | 1.0 |
| **Created** | 2026-09-06 |
| **Complexity** | High |
| **Repo** | digitalvetri/interior-ulagam |
| **Blueprint** | `docs/KONSTDESIGN_CRM_PRODUCT_BLUEPRINT.md` |
| **Approach** | Redesign-in-place (ADR-1) — keep stack, rebuild UI/flow |

---

## PRODUCT OVERVIEW

**Description:** A design-and-execute studio CRM that carries a residential interior project from the first Instagram enquiry through measurement, 3D design approval, quotation, booking, procurement, site execution and post-handover warranty — tracking every rupee of margin in between.

**Value Proposition:** Interior studios lose margin and clients in the gap between Excel quotes and WhatsApp project updates. Konstdesign CRM closes that gap with a single system that enforces the real workflow — measurement feeds quotation, booking creates the project, design approval gates procurement, zero snags gate handover.

**MVP Scope (P0 → P3, first 5 weeks):**
- [ ] Rebrand to Konstdesign; two roles (admin/employee) + six permission flags
- [ ] Leads (7 stages, manual entry, cold-flag, auto-transitions)
- [ ] Site Visits & Measurements (mobile-first, push to quotation)
- [ ] Design Studio (deliverables, versions, client approval)
- [ ] Quotation builder (room-wise, item templates, margin, PDF)
- [ ] Booking → Project creation with milestone seeds
- [ ] Shared PDF system (DocumentLayout + 5 document types)
- [ ] Business Profile settings driving all PDFs

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Framework | Next.js 16 (App Router) — server components first | `skills/FRONTEND.md` |
| Language | TypeScript 5.x strict | `skills/FRONTEND.md` |
| Database | PostgreSQL via Drizzle ORM (SQL-first) | `skills/DATABASE.md` |
| Auth | Better Auth — `admin` \| `employee` + `permissionsJson` | `skills/BACKEND.md` |
| UI | Tailwind CSS + shadcn/ui + CSS variables design system | `skills/FRONTEND.md` |
| PDF | react-pdf (`DocumentLayout` component) + S3 storage | `skills/BACKEND.md` |
| Files | MinIO (S3-compatible) — photos, drawings, PDFs | `skills/BACKEND.md` |
| Jobs | BullMQ (background jobs: PDF gen, WhatsApp send) | `skills/BACKEND.md` |
| WhatsApp | Meta WhatsApp Cloud API (Graph API v21+) | `skills/BACKEND.md` |
| Payments | Razorpay (optional Payment Links) | `skills/BACKEND.md` |
| Validation | Zod — shared client/server schemas in `src/types/` | `skills/BACKEND.md` |
| Testing | Vitest (unit) + Playwright (E2E) | `skills/TESTING.md` |
| Hosting | Vercel (preview per PR, prod on `main`) | `skills/DEPLOYMENT.md` |

> **Money rule:** all monetary values stored as paise (integers). Display only: `(paise / 100).toLocaleString('en-IN')`.

---

## DATABASE MODELS

### Core Identity
```
users           id · tenantId · email · fullName · role(admin|employee)
                permissionsJson · phone · photoUrl · jobTitle · status · emailVerified

tenants         id · name · gstin · brandingJson · waConfig · tallySettings

accounts        id · userId → users · providerId · accountId · password (scrypt)
sessions        id · userId → users · token · expiresAt
```

### CRM
```
leads           id · tenantId · clientId? · contactName · contactPhone · contactEmail
                propertyAddress · propertyType · flatType · scopeJson · budgetBand
                stage(new|contacted|site_visit|measured|quoted|negotiation|booked|lost)
                source · assignedTo → users · notes · lastActivityAt · coldFlagAt
                convertedProjectId? · projectValuePaise

lead_follow_ups id · leadId · tenantId · createdBy → users · scheduledAt · completedAt
                type(call|visit|message) · notes · outcome

clients         id · tenantId · fullName · phone · altPhone · email · city · address
                status(active|past|prospect) · notes · healthScore · healthStatus
                lastContactedAt
```

### Site Visits & Measurements
```
site_visits     id · tenantId · leadId? · projectId? · designerId → users
                scheduledAt · status(scheduled|completed|cancelled)
                address · clientPresent · notes · completedAt

measurement_rounds
                id · tenantId · siteVisitId · leadId? · projectId? · roundNumber
                createdBy → users · notes · status(draft|finalised)

measurement_items
                id · roundId · room · itemName · lengthMm · widthMm · heightMm
                unit(ft|mm) · qty · notes · sketchPhotoUrl
```

### Design Studio
```
design_deliverables
                id · tenantId · leadId? · projectId? · type(mood_board|2d_layout|
                3d_render|working_drawing|material_board) · title · revisionCap
                status(draft|shared|changes_requested|approved) · approvedAt
                approvedBy(client_timestamp) · createdBy → users

deliverable_versions
                id · deliverableId · versionNumber · fileUrl · fileType
                sharedAt · notes · createdBy → users

deliverable_comments
                id · deliverableId · versionId · body · fromClient · createdAt
```

### Quotations
```
quotes          id · tenantId · clientId → clients · leadId? · projectId?
                quoteNumber · version · status(draft|sent|revised|accepted|rejected)
                validUntil · discountPaise · gstPct · totalPaise · marginPaise
                termsText · sentAt · acceptedAt · createdBy → users

quote_sections  id · quoteId · room · sortOrder

quote_lines     id · quoteId · sectionId · itemName · description · finish
                unit · qty · clientRatePaise · costRatePaise · marginPaise
                hsnSac · sortOrder
```

### Projects
```
projects        id · tenantId · clientId → clients · quoteId → quotes
                name · contractValuePaise · stage(design|procurement|installation|
                snagging|handover|complete) · designerId → users
                supervisorId? → users · bookedAt · plannedHandoverAt · actualHandoverAt
                clientPortalToken · notes

project_milestones
                id · projectId · label · pct · amountPaise · dueAt
                invoiceId? · status(pending|invoiced|paid)
```

### Work Orders & Procurement
```
work_orders     id · tenantId · projectId · quoteLineId? · title · type
                (inhouse_carpentry|factory|vendor_job|site_work)
                assignedTo(userId|vendorId) · startDate · dueDate
                status(planned|in_progress|ready|installed) · notes

materials       id · tenantId · name · category · brand · unit
                purchaseRatePaise · sellingRatePaise · vendorId? → vendors
                hsnSac · imageUrl

vendors         id · tenantId · name · category · contactName · phone · email
                city · gstin · bankName · bankAccount · bankIfsc · bankUpi · notes

purchase_orders id · tenantId · projectId · vendorId → vendors
                poNumber · status(draft|sent|partial|complete) · totalPaise
                sentAt · createdBy → users

po_lines        id · poId · materialId? → materials · description · unit
                qty · ratePaise · totalPaise

grns            id · tenantId · poId · poLineId · receivedQty · receivedAt
                notes · receivedBy → users
```

### Site Execution
```
site_logs       id · tenantId · projectId · logDate · workDone · teamOnSite
                delayFlag · delayReason · notes · createdBy → users

site_log_photos id · siteLogId · photoUrl · caption

snag_items      id · tenantId · projectId · room · description · photoUrl
                raisedBy → users · assignedTo → users
                status(open|fixed|client_confirmed) · fixedAt · confirmedAt
```

### Finance
```
invoices        id · tenantId · projectId · milestoneId? · clientId → clients
                invoiceNumber · type(tax_invoice|receipt|adhoc) · status
                (draft|sent|part_paid|paid|overdue) · subtotalPaise · gstPct
                gstPaise · totalPaise · dueAt · sentAt · pdfUrl
                createdBy → users

payments        id · tenantId · invoiceId · projectId · amountPaise
                mode(upi|bank|cash|cheque|razorpay) · reference · paidAt
                razorpayPaymentId? · receiptPdfUrl · recordedBy → users

expenses        id · tenantId · projectId · category · description
                amountPaise · receiptPhotoUrl · date · loggedBy → users

vendor_payables id · tenantId · vendorId · poId · totalPaise · paidPaise
                lastPaidAt
```

### Post-project
```
service_requests
                id · tenantId · clientId → clients · projectId?
                issue · photoUrl · priority(low|medium|high|urgent)
                status(open|assigned|in_progress|resolved) · assignedTo → users
                scheduledVisitAt · resolvedAt · notes

portfolio_items id · tenantId · projectId · title · scope · areaSqft
                clientConsent · coverPhotoUrl · photoUrls · publishedAt

documents       id · tenantId · recordType · recordId · documentType
                (quotation|tax_invoice|receipt|purchase_order|measurement_sheet|
                handover_certificate|statement_of_account)
                pdfUrl · generatedAt
```

### Team
```
tasks           id · tenantId · title · assignedTo → users · relatedType
                relatedId · dueAt · completedAt · notes

notifications   id · tenantId · userId → users · title · body · read · createdAt
```

---

## MODULES

### Module 1 — Auth & Roles (P0)

**Agents:** DATABASE-AGENT + BACKEND-AGENT

**Schema changes:**
- `users.role` enum → `admin | employee`
- Add `users.permissionsJson: { canSeeFinance, canCreateQuotes, canSendQuotes, canRaisePO, canRecordPayments, canSeeAllLeads }`
- Migration: owner→admin, designer→employee+canCreateQuotes, accountant→employee+canSeeFinance+canRecordPayments, supervisor→employee

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/me` | Session + permissions |
| PATCH | `/api/v1/users/[id]/permissions` | Admin: update flags |

**Nav rules:** hide, don't disable. Admin sees all 18 modules. Employee sees only assigned items.

---

### Module 2 — Dashboard (P0 / P6)

**Agents:** FRONTEND-AGENT + BACKEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/dashboard/admin` | KPIs, cold leads, overdue payments, today's schedule |
| GET | `/api/v1/dashboard/employee` | My follow-ups, site visits, tasks, projects |

**Frontend Pages:**
| Route | Component | Notes |
|-------|-----------|-------|
| `/dashboard` | `DashboardPage` | Branches on role — renders AdminDashboard or EmployeeDashboard |

**Admin widgets:** 4 KPI cards · Today (follow-ups, visits, installations) · Enquiry funnel · Projects by stage · Overdue payments · Vendor deliveries due

**Employee widgets:** My follow-ups today · My site visits · My tasks due · My projects (3 rows) · Quick actions

---

### Module 3 — Leads / Enquiries (P2)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Stages (7):** `new → contacted → site_visit → measured → quoted → negotiation → booked | lost`

**Stage transitions** all go through `lib/leads/transitions.ts applyStageTransition()` — never written directly.

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/leads` | List with filters (stage, assigned, source, month) |
| POST | `/api/v1/leads` | Create — phone-matched to existing client or creates one |
| GET | `/api/v1/leads/[id]` | Detail |
| PATCH | `/api/v1/leads/[id]` | Update fields |
| POST | `/api/v1/leads/[id]/stage` | Transition stage via applyStageTransition |
| GET | `/api/v1/leads/[id]/follow-ups` | List follow-ups |
| POST | `/api/v1/leads/[id]/follow-ups` | Add follow-up |
| PATCH | `/api/v1/leads/[id]/follow-ups/[fid]` | Complete follow-up |
| POST | `/api/v1/leads/[id]/brief` | AI brief (Groq) |

**Frontend Pages:**
| Route | Page | Notes |
|-------|------|-------|
| `/leads` | `LeadsPage` | Table: Enquiry · Scope · Stage · Budget · Next follow-up · Assigned · ⋮ |
| `/leads/[id]` | `LeadDetailPage` | Header + tabs: Overview · Follow-ups · Site visits · Measurements · Design · Quotations · Documents · Activity |

**Manual entry drawer fields:** Client name\* · Mobile\* · Alt mobile · Email · Property address\* · City/locality · Property type · Flat type · Scope (multi-select) · Budget band · Source · Assigned to · Notes

**Cold-flag rule:** no follow-up in 7 days → `coldFlagAt` set by daily BullMQ job → Admin dashboard widget.

---

### Module 4 — Clients (P0 — keep existing, polish)

**Agents:** FRONTEND-AGENT

**API Routes (existing):**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/clients` | List |
| POST | `/api/v1/clients` | Create |
| GET | `/api/v1/clients/[id]` | Detail with tabs |
| PATCH | `/api/v1/clients/[id]` | Update |
| POST | `/api/v1/clients/[id]/health-brief` | AI health brief |

**Frontend Pages:**
| Route | Page | Columns |
|-------|------|---------|
| `/clients` | `ClientsPage` | Initials+Name · Mobile · City · Projects · Status · [Open] ⋮ — 44 px rows |
| `/clients/[id]` | `ClientDetailPage` | Tabs: Overview · Projects · Quotations · Payments · Service requests · Activity · WhatsApp |

---

### Module 5 — Site Visits & Measurements (P2)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/site-visits` | List (per lead or project) |
| POST | `/api/v1/site-visits` | Schedule visit |
| PATCH | `/api/v1/site-visits/[id]` | Update / complete |
| POST | `/api/v1/site-visits/[id]/photos` | Upload room photo |
| GET | `/api/v1/measurements` | List rounds for lead/project |
| POST | `/api/v1/measurements` | Create round |
| POST | `/api/v1/measurements/[id]/items` | Add item |
| PATCH | `/api/v1/measurements/[id]/items/[iid]` | Edit item |
| POST | `/api/v1/measurements/[id]/push-to-quote` | Creates quote lines from items (rate=blank) |
| GET | `/api/v1/measurements/[id]/pdf` | Measurement Sheet PDF |

**Frontend:** Mobile-first. Big touch targets. Room tabs. Camera button → MinIO upload. Push-to-quote button generates draft quote and redirects.

---

### Module 6 — Design Studio (P2)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/design/deliverables` | List for lead or project |
| POST | `/api/v1/design/deliverables` | Create deliverable |
| POST | `/api/v1/design/deliverables/[id]/versions` | Upload new version |
| PATCH | `/api/v1/design/deliverables/[id]` | Update status |
| POST | `/api/v1/design/deliverables/[id]/share` | Share via WhatsApp / portal link |
| POST | `/api/v1/design/deliverables/[id]/approve` | Record client approval |
| POST | `/api/v1/design/deliverables/[id]/comments` | Add comment |

**Rules:** "All design approved" gate check before Procurement stage opens. Revision cap enforced per deliverable. Approval timestamp stored for audit.

---

### Module 7 — Quotations (P2)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/quotes` | List |
| POST | `/api/v1/quotes` | Create (from lead or measurement push) |
| GET | `/api/v1/quotes/[id]` | Detail with sections + lines |
| PATCH | `/api/v1/quotes/[id]` | Update header |
| POST | `/api/v1/quotes/[id]/sections` | Add room section |
| POST | `/api/v1/quotes/[id]/sections/[sid]/lines` | Add line |
| PATCH | `/api/v1/quotes/[id]/sections/[sid]/lines/[lid]` | Edit line |
| POST | `/api/v1/quotes/[id]/send` | Mark sent → lead stage = quoted |
| POST | `/api/v1/quotes/[id]/revise` | Create v+1 copy |
| POST | `/api/v1/quotes/[id]/accept` | Accept → triggers Booking modal |
| POST | `/api/v1/quotes/[id]/book` | Advance paid → creates Project + milestones |
| GET | `/api/v1/quotes/[id]/preview` | PDF preview |
| GET | `/api/v1/quotes/[id]/pdf` | Download PDF |
| POST | `/api/v1/quotes/[id]/whatsapp` | Send PDF via WhatsApp |

**Item templates (pre-fill lines):** Modular kitchen L-shape · Sliding wardrobe 7 ft · TV unit · False ceiling per sqft · Pooja unit

**Internal columns** (gated by `canSeeFinance` or `canCreateQuotes`): cost rate, margin %, margin ₹

**Frontend Pages:**
| Route | Page | Notes |
|-------|------|-------|
| `/quotes` | `QuotesPage` | Table: Quote# · vN · Client · Scope · Total · Status · Sent · Valid |
| `/quotes/[id]` | `QuoteBuilderPage` | Room accordion, line editor, totals sidebar, action bar |
| `/quotes/[id]/preview` | `QuotePreviewPage` | react-pdf viewer |

---

### Module 8 — Projects (P4)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Stages (6):** `design → procurement → installation → snagging → handover → complete`

**Gates:**
- procurement: all working drawings approved + advance paid
- handover: zero open snags + final invoice raised

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/projects` | List |
| GET | `/api/v1/projects/[id]` | Detail |
| PATCH | `/api/v1/projects/[id]` | Update (dates, team) |
| POST | `/api/v1/projects/[id]/stage` | Advance stage (checks gates) |
| GET | `/api/v1/projects/[id]/milestones` | List milestones |
| PATCH | `/api/v1/projects/[id]/milestones/[mid]` | Update milestone |

**Frontend:**
| Route | Page | Notes |
|-------|------|-------|
| `/projects` | `ProjectsPage` | Table: Project · Client · Stage · Contract · Collected% · Next milestone · Designer |
| `/projects/[id]` | `ProjectDetailPage` | Stepper + tabs: Overview · Design · Quotation · Work orders · POs · Site logs · Snag list · Payments · Expenses · Documents |

**Right column:** client card · team · dates (booked, planned handover, actual) · money summary (contract, invoiced, collected, due)

---

### Module 9 — Work Orders (P4)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/work-orders` | List (filterable by project, status, type) |
| POST | `/api/v1/work-orders` | Create |
| PATCH | `/api/v1/work-orders/[id]` | Update status / dates |
| GET | `/api/v1/work-orders/calendar` | Week view by due date |

**Frontend:**
| Route | Page | Notes |
|-------|------|-------|
| `/work-orders` | `WorkOrdersPage` | Table + week calendar toggle |

---

### Module 10 — Procurement (P4)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Sub-modules:** Materials · Vendors · Purchase Orders · Deliveries

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/materials` | Catalogue |
| PATCH/DEL | `/api/v1/materials/[id]` | Edit / archive |
| GET/POST | `/api/v1/vendors` | Vendor list / create |
| GET/PATCH | `/api/v1/vendors/[id]` | Vendor detail |
| GET/POST | `/api/v1/purchase-orders` | PO list / create |
| GET/PATCH | `/api/v1/purchase-orders/[id]` | PO detail |
| POST | `/api/v1/purchase-orders/[id]/lines` | Add line |
| POST | `/api/v1/purchase-orders/[id]/receive` | Record delivery (creates GRN) |
| GET | `/api/v1/purchase-orders/[id]/pdf` | PO PDF |
| POST | `/api/v1/purchase-orders/[id]/whatsapp` | Send to vendor |

**FK fix:** `materials.vendorId` and `purchase_orders.vendorId` must reference `vendors.id` — fix in P0 migration.

**Procurement Status** tab on Project shows planned vs ordered vs delivered per item.

---

### Module 11 — Site Execution (P4)

**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/site-logs` | Feed per project |
| POST | `/api/v1/site-logs/[id]/photos` | Upload photos |
| GET/POST | `/api/v1/snags` | Snag list per project |
| PATCH | `/api/v1/snags/[id]` | Update status |
| POST | `/api/v1/snags/[id]/confirm` | Client confirmation (from portal) |
| GET | `/api/v1/projects/[id]/handover-certificate` | Handover Certificate PDF |

**Mobile-first:** large inputs, photo capture, one-minute log goal.

---

### Module 12 — Finance (P5)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Replaces** `/accounts` and `/invoices` with one module at `/finance`.

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/invoices` | Invoice list / create from milestone |
| GET/PATCH | `/api/v1/invoices/[id]` | Detail / update |
| GET | `/api/v1/invoices/[id]/pdf` | Tax Invoice PDF |
| POST | `/api/v1/invoices/[id]/send` | Mark sent |
| POST | `/api/v1/invoices/[id]/payment` | Record payment → Receipt PDF |
| GET/POST | `/api/v1/expenses` | Expenses (per project) |
| GET | `/api/v1/finance/payables` | Vendor payables summary |
| GET | `/api/v1/projects/[id]/statement` | Statement of Account PDF |

**Frontend:**
| Route | Page | Tabs |
|-------|------|------|
| `/finance` | `FinancePage` | Invoices · Payments received · Expenses · Vendor payables |

---

### Module 13 — Documents / PDF System (P3)

**Agents:** BACKEND-AGENT

**One `DocumentLayout` component** (`src/lib/pdf/DocumentLayout.tsx`) used by all document types. Reads branding from `tenants.brandingJson`. Embedded Inter font, A4.

**Document types + jobs:**

| Type | Job file | Trigger |
|------|----------|---------|
| Quotation | `src/lib/pdf/quote.ts` | Quote send / download |
| Tax Invoice | `src/lib/pdf/invoice.ts` | Invoice created |
| Payment Receipt | `src/lib/pdf/receipt.ts` | Payment recorded |
| Purchase Order | `src/lib/pdf/purchase-order.ts` | PO sent |
| Measurement Sheet | `src/lib/pdf/measurement-sheet.ts` | Round finalised |
| Handover Certificate | `src/lib/pdf/handover-certificate.ts` | Handover stage |
| Statement of Account | `src/lib/pdf/statement.ts` | On demand per project |

**Shared `DocumentActions` component:** Preview · Download PDF · Send on WhatsApp — appears on every document-bearing page.

**Storage:** generated PDF → MinIO → `documents.pdfUrl` stored on the record.

---

### Module 14 — Client Portal (P5)

**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Route:** `/p/[token]` (no login, magic link, per project)

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/portal/[token]` | Validate token + return project summary |
| POST | `/api/portal/[token]/approve` | Approve deliverable |
| POST | `/api/portal/[token]/comment` | Request changes on deliverable |
| POST | `/api/portal/[token]/confirm-snag/[id]` | Confirm snag fixed |
| GET | `/api/portal/[token]/pay/[invoiceId]` | Razorpay Payment Link redirect |

---

### Module 15 — Team (P6)

**Agents:** FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/tasks` | Task list / create |
| PATCH | `/api/v1/tasks/[id]` | Complete / update |
| GET | `/api/v1/tasks/mine` | My work view |

**Employees** page already exists — add permission toggle editor (Admin only).

---

### Module 16 — Service & Warranty (P6)

**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/service-requests` | List / create |
| PATCH | `/api/v1/service-requests/[id]` | Assign / resolve |

**Frontend:** `/service` page. Admin dashboard widget: open requests count.

---

### Module 17 — Portfolio (P6)

**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/v1/portfolio` | List / create from project |
| GET | `/api/v1/portfolio/[id]/brochure` | WhatsApp brochure PDF |

---

### Module 18 — Reports (P6)

**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Six fixed reports** (date range + export Excel/PDF):

| Report | Key metrics |
|--------|-------------|
| Enquiry funnel & sources | Stage counts, conversion %, source breakdown |
| Quotation conversion | Conversion rate, avg quote value, by designer |
| Project pipeline & delays | Stage distribution, avg days per stage, delayed flag |
| Collections & outstanding | Invoiced vs collected, overdue by age bucket |
| Project profitability | Contract − materials − work orders − expenses = margin |
| Vendor spend | PO totals by vendor, category |

**API Routes:**
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/reports/[type]` | Report data (date range params) |
| GET | `/api/v1/reports/[type]/export` | Excel / PDF download |

---

### Module 19 — Settings (P3 / P6)

**Agents:** FRONTEND-AGENT

**Tabs:**

| Tab | Fields |
|-----|--------|
| Business Profile | Logo · Legal name · Address · Phone · Email · GSTIN · Bank/UPI · Signatory |
| Documents | Prefixes (QUO/INV/PO/RCT) · Terms per doc type · Quote validity days · GST % · Place of supply |
| Milestones | Default schedule (10/40/40/10) — editable per row |
| Pipeline | Stage labels · Cold-flag days · Revision cap |
| Users & Permissions | Employee list + 6 permission toggles per person |
| Integrations | WhatsApp phone number ID · Razorpay keys · Tally export |
| Data | Export CSV/JSON · Backup · Restore |

---

## PHASE EXECUTION PLAN

### Phase 0 — Foundation & Rebrand (Week 1)
**4 agents in parallel**

- **DATABASE-AGENT:** Role migration (admin/employee + permissionsJson); lead stage enum update with data mapping; materials/PO vendor FK fix; add missing tables (measurement_items, design_deliverables, deliverable_versions, deliverable_comments, work_orders, grns, service_requests, portfolio_items, tasks); Drizzle migration files
- **BACKEND-AGENT:** `lib/leads/transitions.ts` single transition function; `getAuthContext` returns role + permissions; update all `roles[]` checks to `admin|employee`; remove dead routes (/attendance, /inventory)
- **FRONTEND-AGENT:** Replace all "Interior OS" strings → "Konstdesign"; nav-items.ts per role; sidebar, TopBar, login page, manifest; remove dead nav links
- **DEVOPS-AGENT:** Update CI env, Vercel env vars, README

**Gate P0:** `pnpm tsc --noEmit` clean · `pnpm vitest run` green · login + sidebar screenshots per role

---

### Phase 1 — Shared UI Kit (Week 2)
**1 agent, sequential**

- **FRONTEND-AGENT:** `src/components/ui/{PageHeader, StatCard, DataTable, StatusBadge, EmptyState, ConfirmDialog, FormField, Drawer, Skeleton, Toast}.tsx` — CSS variables only, no inline styles; `src/lib/status-maps.ts`; apply Konstdesign palette in globals.css (charcoal `#1E1E1E`, warm neutrals, gold accent `#C9A24A`); migrate Leads, Clients, Quotations lists to DataTable

**Gate P1:** `grep -rn "function StatusBadge\|function EmptyState" src/app` → 0 results; list screenshots 1440 px + 390 px

---

### Phase 2 — Enquiry → Booking (Weeks 3–4)
**3 agent pairs in parallel**

- **DATABASE-AGENT + BACKEND-AGENT:** Leads API (7 stages, cold-flag job, manual entry, follow-ups); Site Visits & Measurements API (rooms, items, push-to-quote); Design Studio API (deliverables, versions, approvals)
- **BACKEND-AGENT:** Quotation API (sections, lines, item templates, margin, send, revise, accept, book → project); Booking creates Project + milestone seeds from Settings
- **FRONTEND-AGENT:** Lead drawer form, Lead detail 8 tabs, Measurement mobile UI, Design Studio deliverable cards, Quotation builder with room accordion and margin columns, Booking modal

**Gate P2:** Playwright E2E `tests/e2e/enquiry-to-booking.spec.ts` green

---

### Phase 3 — Documents & Settings (Week 5)
**2 agents in parallel**

- **BACKEND-AGENT:** `src/lib/pdf/DocumentLayout.tsx` + Inter font; 5 PDF jobs (quote, invoice, receipt, PO, measurement-sheet); BullMQ workers; MinIO upload; `documents` table writes; WhatsApp send integration
- **FRONTEND-AGENT:** Settings page Business Profile + Documents tabs; `DocumentActions` component (Preview / Download / WhatsApp) wired to all pages; Project → Documents tab

**Gate P3:** 5 generated PDF samples attached showing logo, GSTIN, totals, terms, bank, page numbers

---

### Phase 4 — Delivery (Weeks 6–7)
**3 agent pairs in parallel**

- **DATABASE-AGENT + BACKEND-AGENT:** Projects API (stage gates, tabs, right-column money); Work Orders API + calendar; Procurement API (vendors, POs, GRN deliveries per line, procurement status)
- **BACKEND-AGENT + FRONTEND-AGENT:** Site logs mobile feed; installation calendar; Snag list; Handover Certificate PDF; Project Detail all tabs
- **FRONTEND-AGENT:** Work Orders list + calendar view; Procurement pages (materials catalogue, vendor detail, PO builder + receive drawer)

**Gate P4:** Playwright `tests/e2e/delivery.spec.ts` green

---

### Phase 5 — Finance & Client Portal (Weeks 8–9)
**2 agents in parallel**

- **BACKEND-AGENT + FRONTEND-AGENT:** Finance module `/finance` 4 tabs (replace /accounts + /invoices); Invoice list/detail + Record-payment drawer → Receipt PDF; Expenses + receipt photo; Statement of Account PDF; Vendor payables
- **FRONTEND-AGENT:** Client portal `/p/[token]` — deliverable approve/changes, quotation view, invoices + Pay Now, site photos, snag confirmation; Razorpay Payment Link

**Gate P5:** E2E milestone→invoice→payment→receipt green; portal approval visible in Design Studio tab

---

### Phase 6 — Team, Service, Reports, Settings (Weeks 9–10)
**3 agents in parallel**

- **FRONTEND-AGENT:** Team Tasks (any record, my work view); Users & permissions tab (6 toggles); Settings remaining tabs (Milestones, Pipeline, Integrations, Data)
- **BACKEND-AGENT + FRONTEND-AGENT:** Service & Warranty module; Portfolio (photo picker, brochure PDF); 6 Reports with Excel/PDF export
- **FRONTEND-AGENT:** Admin Dashboard (all widgets, cold-leads, overdue); Employee Dashboard (my work); Dashboard API endpoints

**Gate P6:** Report exports attached; QA checklist completed for admin + employee roles

---

### Phase 7 — Migration & Go-live (Week 11)
**1 agent**

- **DATABASE-AGENT:** `scripts/migrate-konstdesign.ts` — map legacy lead stages, consolidate follow-ups, map roles/permissions, backfill clients, verify FK integrity, before/after count report; run on DB copy first; `docs/RUNBOOK_GO_LIVE.md`

**Gate P7:** Migration diff report attached; training sign-off

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| P0 | `pnpm tsc --noEmit` · `pnpm vitest run` · `pnpm drizzle-kit push --dry-run` |
| P1 | `grep -rn "function StatusBadge" src/app` → 0 · `pnpm lint` |
| P2 | `pnpm playwright test tests/e2e/enquiry-to-booking.spec.ts` |
| P3 | Attach 5 PDF samples (quote, invoice, receipt, PO, measurement) |
| P4 | `pnpm playwright test tests/e2e/delivery.spec.ts` |
| P5 | E2E finance + portal green |
| P6 | Report exports · QA checklist both roles |
| P7 | Migration diff report · `pnpm tsc --noEmit` on migrated DB |

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://interioos_app:password@localhost:5442/interior_studio

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# MinIO / S3
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=konstdesign

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# Razorpay (optional)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# AI
GROQ_API_KEY=
GOOGLE_AI_API_KEY=

# BullMQ / Redis
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=          # legacy — being phased out
```

---

## AGENT ASSIGNMENTS

| Agent | Phases | Primary responsibility |
|-------|--------|----------------------|
| DATABASE-AGENT | P0, P2, P4, P7 | Drizzle schema, migrations, RLS, FK fixes, data migration |
| BACKEND-AGENT | P0, P2, P3, P4, P5 | API routes, lib/ (auth, pdf, whatsapp, payments, ai), BullMQ jobs |
| FRONTEND-AGENT | P0–P6 | Next.js pages, shadcn components, mobile-first, DataTable, DocumentActions |
| DEVOPS-AGENT | P0 | CI/CD, env wiring, Vercel config, Docker |
| TEST-AGENT | P2, P4, P5 | Vitest unit tests, Playwright E2E specs |
| REVIEW-AGENT | P6 | Security audit (permissions gate coverage, webhook signatures, OWASP) |

---

## KEY BUSINESS RULES (enforce in every agent)

1. **Money in paise** — integers only; never floats; format at display layer only
2. **Single transition function** — all lead stage writes via `lib/leads/transitions.ts`
3. **Project created only at Booking** — never from the lead directly
4. **Gate checks are hard** — procurement stage blocked until drawings approved + advance paid; handover blocked until zero open snags + final invoice raised
5. **Permissions are hidden, not disabled** — nav items and action buttons not rendered when flag is false
6. **One PDF layout** — all 7 document types use `DocumentLayout`; branding from `tenants.brandingJson`
7. **Cold-flag job** — BullMQ daily cron sets `leads.coldFlagAt` when no follow-up in N days (configurable in Settings → Pipeline)
8. **Tenant-scoped queries** — every DB query filters by `tenantId`; Inngest jobs pass `tenantId` explicitly

---

## NEXT STEP

```
/execute-prp PRPs/konstdesign-crm-prp.md
```

Start with Phase 0 prompt (paste-ready in blueprint §11 P0).
