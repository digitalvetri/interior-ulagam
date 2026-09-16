# INITIAL.md - Shadow Market Product Definition

> A SaaS dashboard that turns raw printer CSV logs into actionable cost and toner yield insights for business owners — combining print job data with paper costs, ink costs, and toner replacement logs to show resource utilization, waste, cost per print, and toner yield efficiency.

---

## PRODUCT

### Name
Shadow Market

### Description
Shadow Market helps small business owners understand the true cost of their printing operations. Users can upload CSV logs manually or push them automatically via a dedicated API endpoint (deployed as a script on the printer server). Each printer has its own column mapping configuration so any printer brand or firmware is supported. The system combines parsed print jobs with preloaded paper costs, ink costs, and toner replacement logs to generate a visual dashboard, cost reports, and — critically — toner yield reports that show actual vs. rated yield, cost per page efficiency, and estimated replacement dates. Owners are alerted via Email and Telegram. All features are exposed via a full REST API for n8n and other automation tools.

### Target User
Small business owners running one or more printers who need visibility into printing costs and toner consumption without reading raw logs.

### Type
- [x] SaaS (Software as a Service)

---

## TECH STACK

| Layer | Choice |
|-------|--------|
| Backend | FastAPI + Python 3.11+ |
| Frontend | React + Vite + TypeScript |
| Database | PostgreSQL + SQLAlchemy |
| Auth | JWT (Email/Password) |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| Background Jobs | APScheduler (monthly reports, notifications) |
| PDF Export | WeasyPrint or ReportLab |
| Excel Export | openpyxl |
| CSV Parsing | Python csv + pandas |
| Payments | None (post-MVP) |

---

## ROLES

| Role | Description |
|------|-------------|
| **Owner** | Full access: configure costs, view all reports, manage printers, manage users, access admin panel, manage API keys, configure webhooks |
| **Print Person** | Limited access: upload CSV logs manually, log toner replacements, view toner replacement history |

---

## LOG INGESTION METHODS

### Method 1: Manual Upload (Web UI)
Owner or Print Person uploads a CSV file through the browser on the printer detail page.

### Method 2: Direct API Push (Automated — Recommended)
Each printer has one or more API keys. A script deployed on the printer server POSTs the CSV file directly to Shadow Market:

```
POST /api/v1/ingest/{printer_api_key}/logs
Content-Type: multipart/form-data
Body: csv_file=<file>
```

No user login required. The API key identifies the printer. Shadow Market handles deduplication, parsing, and cost calculation automatically.

**Sample printer server script (Python):**
```python
import requests

csv_file = "/var/printer/logs/latest.csv"
api_key  = "pk_live_abc123..."  # from Shadow Market admin panel

response = requests.post(
    "https://your-shadow-market.com/api/v1/ingest/{api_key}/logs".format(api_key=api_key),
    files={"csv_file": open(csv_file, "rb")}
)
print(response.json())
```

### Method 3: Via n8n (Email / FTP)
Shadow Market exposes a full REST API. n8n workflows can:
- Watch an email inbox → extract CSV attachment → POST to Shadow Market ingest API
- Poll an FTP folder → read CSV → POST to Shadow Market ingest API
- Receive outbound webhooks from Shadow Market → route to Slack, Teams, WhatsApp, etc.

---

## N8N INTEGRATION

Shadow Market exposes:
1. **Full REST API** — all features accessible (auth via API key or Bearer JWT)
2. **Outbound Webhooks** — Shadow Market POSTs events to any configured URL (n8n webhook node)

### Webhook Events
| Event | Trigger |
|-------|---------|
| `log_imported` | CSV upload processed successfully |
| `high_cost_alert` | Daily cost exceeds configured threshold |
| `toner_low` | Estimated remaining pages below threshold |
| `toner_yield_warning` | Actual yield is significantly below rated yield |
| `monthly_report_ready` | Monthly report generated |
| `weekly_summary_ready` | Weekly summary generated |

### Webhook Payload Example
```json
{
  "event": "high_cost_alert",
  "timestamp": "2026-04-15T08:00:00Z",
  "printer_name": "Press Room A",
  "date": "2026-04-15",
  "daily_cost": 4250.00,
  "threshold": 3000.00,
  "currency": "INR"
}
```
Payloads are HMAC-signed with a configurable secret so n8n can verify authenticity.

---

## MODULES

---

### Module 1: Authentication & Role Management

**Description:** JWT authentication with two roles — Owner and Print Person.

**Models:**

`users`
- id, email, hashed_password, full_name
- role: enum(owner, print_person)
- is_active, created_at, updated_at

`refresh_tokens`
- id, user_id (FK), token, expires_at, revoked

**API Endpoints:**
- `POST /auth/register` — Create owner account
- `POST /auth/login` — Login, returns access + refresh tokens
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Revoke refresh token
- `GET  /auth/me` — Current user profile
- `PUT  /auth/me` — Update profile

**Frontend Pages:**
- `/login` — Login
- `/register` — Owner registration
- `/profile` — Profile settings

---

### Module 2: Printer Management & Column Mapping

**Description:** Register printers and configure per-printer CSV column mapping. Each printer maps its actual CSV headers to Shadow Market's canonical internal field names.

**Models:**

`printers`
- id, owner_id (FK → users)
- name, model, type, serial_number, location
- column_mapping: JSON — maps canonical field names → actual CSV column headers
- is_active, created_at, updated_at

**Canonical Fields (internal names the system always uses):**
```
job_id, job_name, status, owner_name,
recorded_at, arrived_at, printed_at,
color_mode, paper_type, paper_size, paper_width_mm, paper_length_mm,
is_duplex, copies,
input_pages, printed_pages, color_pages, bw_pages,
specialty_pages, gold_pages, silver_pages, clear_pages,
white_pages, texture_pages, pink_pages,
blank_pages, printed_sheets, waste_sheets, error_info
```

**Default column_mapping (for this printer model):**
```json
{
  "job_id":          "ID",
  "job_name":        "Job Name",
  "status":          "Status",
  "owner_name":      "Owner",
  "recorded_at":     "Recorded Date/Time",
  "arrived_at":      "Arrived",
  "printed_at":      "Printed",
  "color_mode":      "Color Mode",
  "paper_type":      "Paper Type",
  "paper_size":      "Paper Size",
  "paper_width_mm":  "Paper Width",
  "paper_length_mm": "Paper Length",
  "is_duplex":       "2 Sided",
  "copies":          "Copies",
  "input_pages":     "Input Pages",
  "printed_pages":   "Printed Pages",
  "color_pages":     "Printed Color Pages",
  "bw_pages":        "Printed Black & White Pages",
  "specialty_pages": "Pages Printed with Specialty Toner",
  "gold_pages":      "Pages Printed with GLD #1",
  "silver_pages":    "Pages Printed with SLV #1",
  "clear_pages":     "Pages Printed with CLR #1",
  "white_pages":     "Pages Printed with WHT #1",
  "texture_pages":   "Pages Printed with CR #1",
  "pink_pages":      "Pages Printed with P #1",
  "blank_pages":     "Printed Blank Pages",
  "printed_sheets":  "Printed Sheets",
  "waste_sheets":    "Waste Sheets",
  "error_info":      "Error Info"
}
```
When a new printer brand is added with different column names, only this JSON changes. The parser and cost engine remain unchanged.

**API Endpoints:**
- `POST   /printers` — Add printer with column mapping (Owner)
- `GET    /printers` — List printers
- `GET    /printers/{id}` — Printer detail + stats
- `PUT    /printers/{id}` — Update printer / column mapping (Owner)
- `DELETE /printers/{id}` — Deactivate (Owner)
- `GET    /printers/{id}/column-mapping` — Get current mapping
- `PUT    /printers/{id}/column-mapping` — Update mapping
- `POST   /printers/{id}/column-mapping/validate` — Upload a sample CSV to validate mapping (returns matched/unmatched fields)

**Frontend Pages:**
- `/printers` — Printer list with per-printer quick stats
- `/printers/new` — Add printer + configure column mapping
- `/printers/{id}` — Detail: upload logs, view jobs, manage API keys
- `/printers/{id}/mapping` — Column mapping editor with live CSV preview

---

### Module 3: Printer API Keys

**Description:** Per-printer API keys for server-to-server log ingestion. Used by the printer server script and n8n.

**Models:**

`printer_api_keys`
- id, printer_id (FK), owner_id (FK)
- key_prefix: varchar(8) — shown in UI (e.g. "pk_abc123")
- key_hash: varchar — bcrypt hash of full key (never stored plain)
- label: varchar — e.g. "Server Room Script", "n8n Workflow"
- last_used_at, is_active, created_at

**API Endpoints:**
- `POST   /printers/{id}/api-keys` — Generate new API key (returned once, then hashed)
- `GET    /printers/{id}/api-keys` — List keys (prefix + label only, never full key)
- `DELETE /printers/{id}/api-keys/{key_id}` — Revoke key

**Ingest Endpoint (unauthenticated — uses API key in path):**
- `POST /api/v1/ingest/{printer_api_key}/logs` — Receive CSV, parse, store jobs

**Frontend Pages:**
- `/printers/{id}` — API Keys section: generate, list, revoke

---

### Module 4: CSV Log Upload & Parsing

**Description:** Parse uploaded CSV files using the printer's column mapping. Supports both manual web upload and API push.

**Models:**

`upload_batches`
- id, printer_id (FK), uploaded_by_user_id (FK, nullable for API push)
- source: enum(manual, api_push)
- filename, uploaded_at
- rows_total, rows_imported, rows_skipped
- skipped_details: JSON — list of {row_number, reason} for skipped rows
- status: enum(processing, completed, failed)

`print_jobs`
- id, printer_id (FK), upload_batch_id (FK)
- job_id: varchar — from CSV ID column
- job_name, status, owner_name
- recorded_at, arrived_at, printed_at
- color_mode: enum(full_color, grayscale, unknown)
- paper_type: varchar — raw CSV value, used to join `papers`
- paper_size, paper_width_mm, paper_length_mm
- is_duplex: bool
- copies, input_pages, printed_pages
- color_pages, bw_pages
- specialty_pages, gold_pages, silver_pages, clear_pages
- white_pages, texture_pages, pink_pages
- blank_pages, printed_sheets, waste_sheets
- error_info
- computed_paper_cost, computed_toner_cost, computed_total_cost
- is_waste: bool — true when status is Error or waste_sheets > 0

**Deduplication rule:** same printer_id + job_id + recorded_at = skip (do not re-import).

**Parsing logic:**
1. Load printer's `column_mapping`
2. Map CSV headers to canonical fields using the mapping
3. Validate required fields present
4. Parse dates, integers, booleans
5. Look up paper cost from `papers` table by matching `paper_type` string
6. Calculate per-job cost immediately at import
7. Store results, report skipped rows

**API Endpoints:**
- `POST /printers/{id}/logs/upload` — Manual upload (multipart, authenticated)
- `POST /api/v1/ingest/{api_key}/logs` — API push (API key auth)
- `GET  /printers/{id}/upload-batches` — List upload history
- `GET  /printers/{id}/upload-batches/{batch_id}` — Batch detail + skipped rows
- `GET  /printers/{id}/jobs` — List print jobs with filters (date, status, color mode)

**Frontend Pages:**
- `/printers/{id}` — Upload CSV section + batch history

---

### Module 5: Cost Configuration

**Description:** Configure paper types, ink costs per printer, and log toner replacements — the data used in all cost calculations.

**Models:**

`papers`
- id, owner_id (FK)
- name: varchar — **must match CSV `Paper Type` value exactly** (e.g. `"Custom,White,221 - 256gsm"`)
- display_name: varchar — human-friendly label
- length_mm, width_mm
- gsm_min, gsm_max
- counter_multiplier: decimal — A3 = 2.0 (counts as 2× A4 for cost), A4 = 1.0
- price_per_sheet: decimal
- currency: varchar

`toners`
- id, printer_id (FK)
- toner_color: varchar — e.g. "Black", "Cyan", "Magenta", "Yellow", "Gold", "Silver", "Clear", "White", "Texture", "Pink"
- toner_type: enum(standard, specialty)
- price_per_unit: decimal
- rated_yield_pages: int — manufacturer's rated pages per cartridge
- currency: varchar

`toner_replacement_logs`
- id, printer_id (FK), toner_id (FK)
- replaced_by_user_id (FK)
- counter_reading_at_replacement: int — printer page counter at time of swap
- replaced_at: datetime
- notes: text
- actual_yield_pages: int — computed as (this counter - previous replacement counter)
- yield_efficiency_pct: decimal — actual_yield / rated_yield × 100

**API Endpoints:**
- `GET/POST        /cost-config/papers` — List / create paper types (Owner)
- `PUT/DELETE      /cost-config/papers/{id}` — Update / delete
- `GET/PUT         /printers/{id}/ink-costs` — Get or update ink cost config per printer
- `GET             /printers/{id}/toners` — List configured toners
- `POST            /printers/{id}/toners` — Add toner config (Owner)
- `PUT/DELETE      /printers/{id}/toners/{id}` — Update / delete toner
- `GET             /printers/{id}/toner-replacements` — List replacement history
- `POST            /printers/{id}/toner-replacements` — Log a replacement (Owner + Print Person)
- `PUT             /printers/{id}/toner-replacements/{id}` — Edit (Owner always; Print Person within 24h)
- `DELETE          /printers/{id}/toner-replacements/{id}` — Delete (Owner only)

**Frontend Pages:**
- `/settings/costs` — Paper types + ink cost configuration
- `/settings/toner-replacements` — Replacement log (Print Person can add entries)

---

### Module 6: Toner Yield Report (Key Feature)

**Description:** Shows actual toner yield vs. manufacturer-rated yield per cartridge, per color, per printer. Helps owners understand if they are getting full value from toner cartridges and what their real cost per page is.

**Yield Calculation Logic:**
```
actual_yield         = counter_at_this_replacement - counter_at_previous_replacement
yield_efficiency_pct = actual_yield / toner.rated_yield_pages × 100
actual_cost_per_page = toner.price_per_unit / actual_yield
rated_cost_per_page  = toner.price_per_unit / toner.rated_yield_pages
cost_variance_pct    = (actual_cost_per_page - rated_cost_per_page) / rated_cost_per_page × 100

-- For current (in-use) cartridge:
pages_used_so_far        = current_counter - last_replacement_counter
estimated_remaining_pgs  = rated_yield_pages - pages_used_so_far
daily_print_rate         = avg pages/day over last 30 days
estimated_days_remaining = estimated_remaining_pgs / daily_print_rate
estimated_replacement_dt = today + estimated_days_remaining
```

**Waste detection:**
If a cartridge is replaced before reaching 80% of rated yield → flagged as early replacement with cost waste amount.

**Report Contents:**
1. **Current Cartridge Status** (per color, per printer)
   - Pages used / pages remaining (progress bar)
   - Estimated replacement date
   - Current actual cost per page

2. **Historical Yield per Cartridge** (table)
   - Replacement date, toner color, rated yield, actual yield, efficiency %, actual cost/page, rated cost/page, variance

3. **Yield Efficiency Chart** — bar chart per cartridge swap over time (per color)

4. **Cost Variance Summary** — total overspend due to below-rated yield

5. **Per-Color Comparison** — which color consistently underperforms rated yield

**API Endpoints:**
- `GET /reports/toner-yield?printer_id=&period=` — Full yield report data
- `GET /reports/toner-yield/current-status?printer_id=` — Current cartridge status for all colors
- `GET /reports/toner-yield/history?printer_id=&toner_color=` — Historical yield per color
- `GET /reports/toner-yield/export?format=pdf|excel&printer_id=&period=` — Export

**Frontend Pages:**
- `/reports/toner-yield` — Toner yield report with charts + history table

---

### Module 7: Analytics Dashboard

**Description:** Visual overview of cost, usage, and waste across all printers.

**Computed Metrics:**
- Total cost per period (day/week/month/year)
- Cost per print (color vs. B&W)
- Paper cost vs. toner cost breakdown
- Pages printed vs. wasted (Error jobs + waste_sheets)
- Specialty toner usage (Gold, Silver, Clear, White)
- Cost per printer comparison
- Daily/weekly trend lines

**Cost Calculation (per job):**
```
paper_cost  = printed_sheets × paper.price_per_sheet × paper.counter_multiplier
color_cost  = color_pages × toner[color].price / toner[color].rated_yield
bw_cost     = bw_pages × toner[black].price / toner[black].rated_yield
gold_cost   = gold_pages × toner[gold].price / toner[gold].rated_yield
... (same for silver, clear, white, texture, pink)

total_job_cost = paper_cost + color_cost + bw_cost + specialty_costs
waste_cost     = waste_sheets × paper.price_per_sheet × paper.counter_multiplier
```

**API Endpoints:**
- `GET /analytics/summary?period=&printer_id=` — KPI cards
- `GET /analytics/cost-breakdown?period=&printer_id=` — Cost by category
- `GET /analytics/utilization?period=&printer_id=` — Pages + waste metrics
- `GET /analytics/trends?period=&printer_id=` — Time-series for charts
- `GET /analytics/printers/compare` — Side-by-side printer cost comparison
- `GET /analytics/specialty-toner?period=` — Specialty toner usage breakdown

**Frontend Pages:**
- `/dashboard` — KPI cards + cost trend chart + waste % + top printers
- `/analytics` — Detailed view with filters (printer, date range, color mode, paper type)

---

### Module 8: Reports (Export)

**Description:** Generate downloadable cost and yield reports.

**Report Types:**
- Cost summary (period: week / month / quarter / year)
- Toner yield report (see Module 6)
- Per-printer detail report
- Waste analysis report

**API Endpoints:**
- `GET /reports/export?type=cost|yield|waste&format=pdf|excel&period=&printer_id=` — Generate + download
- `GET /reports/history` — Previously generated reports

**Frontend Pages:**
- `/reports` — Report builder: choose type, period, printer, format, download

---

### Module 9: Notifications

**Description:** Alert owners via Email and Telegram. Configurable per user with threshold settings.

**Models:**

`notification_configs`
- id, user_id (FK)
- email_enabled, email_address
- telegram_enabled, telegram_chat_id, telegram_bot_token
- high_cost_threshold: decimal — daily cost alert trigger
- toner_low_pages_threshold: int — alert when estimated remaining pages below this
- toner_yield_warning_pct: int — alert when yield efficiency below this % (e.g. 70%)
- monthly_report_enabled, weekly_summary_enabled
- updated_at

**Notification Triggers:**
- High cost: daily total > threshold → immediate alert
- Toner low: estimated remaining pages < threshold → daily check
- Toner yield warning: yield efficiency < threshold % → on replacement log
- Monthly report: 1st of month at 08:00 (background job)
- Weekly summary: Monday 08:00 (background job)

**API Endpoints:**
- `GET  /notifications/config` — Get settings
- `PUT  /notifications/config` — Update (email, Telegram, thresholds)
- `POST /notifications/test` — Send test notification via all enabled channels

**Frontend Pages:**
- `/settings/notifications` — Configure channels + thresholds, send test

---

### Module 10: Outbound Webhooks

**Description:** Shadow Market fires events to configured URLs (for n8n and other automation tools).

**Models:**

`webhook_configs`
- id, owner_id (FK)
- url: varchar — endpoint to POST to
- events: JSON array — e.g. `["log_imported", "high_cost_alert", "toner_low", "toner_yield_warning"]`
- secret: varchar — HMAC signing secret
- is_active, created_at

`webhook_delivery_logs`
- id, webhook_config_id (FK)
- event, payload (JSON), response_status, response_body
- delivered_at, failed: bool

**API Endpoints:**
- `GET/POST        /webhooks` — List / create webhook configs (Owner)
- `PUT/DELETE      /webhooks/{id}` — Update / delete
- `POST            /webhooks/{id}/test` — Send test payload
- `GET             /webhooks/{id}/logs` — Delivery history

**Frontend Pages:**
- `/settings/webhooks` — Manage webhook configs + delivery logs

---

### Module 11: Admin Panel

**Description:** Owner-only admin with user management and full cost/yield overview.

**API Endpoints:**
- `GET  /admin/users` — List all users
- `POST /admin/users` — Invite a Print Person
- `PUT  /admin/users/{id}` — Update role, deactivate
- `DELETE /admin/users/{id}` — Remove user
- `GET  /admin/stats` — Platform stats: total prints, total cost, active printers
- `GET  /admin/cost-summary` — Cost breakdown across all printers
- `GET  /admin/toner-summary` — Toner yield overview across all printers

**Frontend Pages:**
- `/admin` — Stats + cost + toner summary
- `/admin/users` — User management: invite, roles, deactivate

---

## MVP SCOPE

### Must Have (MVP)
- [x] Owner registration + login
- [x] Print Person invite by Owner
- [x] Add printers + configure column mapping
- [x] Printer API key generation for automated log push
- [x] Manual CSV upload + API push ingestion (both methods)
- [x] Per-printer column mapping editor with CSV validation
- [x] Paper type cost configuration
- [x] Toner configuration (per printer, per color, rated yield)
- [x] Print Person can manually log toner replacements with counter reading
- [x] Toner yield report (actual vs. rated yield, cost per page, efficiency %)
- [x] Analytics dashboard with cost + waste charts
- [x] Email + Telegram notification configuration and alerts
- [x] PDF + Excel report export
- [x] Admin panel with user management and cost/toner overview
- [x] Outbound webhook system (for n8n integration)

### Nice to Have (Post-MVP)
- [ ] Google OAuth login
- [ ] Stripe subscription billing
- [ ] n8n workflow templates pre-built for Shadow Market
- [ ] Mobile-responsive PWA
- [ ] Multi-owner / team workspaces
- [ ] Automated report email delivery schedule
- [ ] Printer counter auto-read via SNMP (no CSV needed)

---

## ACCEPTANCE CRITERIA

### Authentication & Roles
- [ ] Owner registers and logs in with email/password
- [ ] Print Person receives invite and sets up account
- [ ] Role-based access enforced on all endpoints
- [ ] JWT access + refresh token flow works correctly

### Printer & Column Mapping
- [ ] Owner adds a printer and configures column mapping
- [ ] Column mapping validation endpoint correctly identifies matched/unmatched fields against a sample CSV
- [ ] Default mapping is pre-filled for the supported printer model

### CSV Ingestion
- [ ] Manual upload via web UI parses and stores jobs correctly
- [ ] API push via printer API key works without user login
- [ ] Deduplication: re-uploading same CSV does not create duplicate jobs
- [ ] Invalid/skipped rows are reported back in the batch response
- [ ] Batch status (processing → completed) is visible in UI

### Cost Configuration
- [ ] Paper types configured with name matching CSV values exactly
- [ ] Toner configured per printer per color with rated yield
- [ ] Toner replacement logged with counter reading
- [ ] Print Person can add replacements; Owner can edit/delete all

### Toner Yield Report
- [ ] Actual yield calculated correctly from counter readings
- [ ] Yield efficiency % displayed per cartridge swap
- [ ] Actual vs. rated cost per page shown for each replacement
- [ ] Current cartridge status shows pages used / estimated remaining
- [ ] Estimated replacement date calculated from daily print rate
- [ ] Early replacement flagged when yield < 80% of rated
- [ ] Export as PDF and Excel works

### Analytics Dashboard
- [ ] KPI cards show total cost, pages printed, waste %, cost per print
- [ ] Charts filterable by printer and date range
- [ ] Specialty toner (Gold, Silver, etc.) shown separately
- [ ] Data refreshes after each CSV import

### Notifications
- [ ] Email alert sent when daily cost exceeds threshold
- [ ] Telegram alert sent when toner estimated pages below threshold
- [ ] Toner yield warning sent when efficiency below configured %
- [ ] Monthly report auto-generated and sent on 1st of month

### Webhooks
- [ ] Webhook fires to configured URL on log_imported, high_cost_alert, toner_low events
- [ ] HMAC signature on payload for security
- [ ] Delivery log shows success/failure per webhook call

### Admin Panel
- [ ] Owner views and manages all users
- [ ] Admin shows aggregated cost and toner yield across all printers

### Quality
- [ ] All endpoints documented in OpenAPI (Swagger at /docs)
- [ ] Backend test coverage 80%+
- [ ] TypeScript strict mode passes
- [ ] Docker Compose builds and runs

---

## DATABASE SCHEMA SUMMARY

```
users                   — id, email, hashed_password, full_name, role, is_active
refresh_tokens          — id, user_id, token, expires_at, revoked

printers                — id, owner_id, name, model, type, serial_number, location, column_mapping (JSON), is_active
printer_api_keys        — id, printer_id, owner_id, key_prefix, key_hash, label, last_used_at, is_active

papers                  — id, owner_id, name, display_name, length_mm, width_mm, gsm_min, gsm_max, counter_multiplier, price_per_sheet
toners                  — id, printer_id, toner_color, toner_type, price_per_unit, rated_yield_pages
toner_replacement_logs  — id, printer_id, toner_id, replaced_by_user_id, counter_reading_at_replacement, replaced_at, actual_yield_pages, yield_efficiency_pct, notes

upload_batches          — id, printer_id, uploaded_by_user_id, source, filename, uploaded_at, rows_total, rows_imported, rows_skipped, skipped_details (JSON), status
print_jobs              — id, printer_id, upload_batch_id, job_id, job_name, status, owner_name, recorded_at, arrived_at, printed_at, color_mode, paper_type, paper_size, paper_width_mm, paper_length_mm, is_duplex, copies, input_pages, printed_pages, color_pages, bw_pages, specialty_pages, gold_pages, silver_pages, clear_pages, white_pages, texture_pages, pink_pages, blank_pages, printed_sheets, waste_sheets, error_info, computed_paper_cost, computed_toner_cost, computed_total_cost, is_waste

notification_configs    — id, user_id, email_enabled, email_address, telegram_enabled, telegram_chat_id, telegram_bot_token, high_cost_threshold, toner_low_pages_threshold, toner_yield_warning_pct, monthly_report_enabled, weekly_summary_enabled
webhook_configs         — id, owner_id, url, events (JSON), secret, is_active
webhook_delivery_logs   — id, webhook_config_id, event, payload (JSON), response_status, delivered_at, failed
```

---

## SPECIAL REQUIREMENTS

### Security
- [x] Rate limiting on auth endpoints (5 req/min)
- [x] API keys stored as bcrypt hashes — never stored or returned in plain text
- [x] Webhook payloads HMAC-signed with SHA-256
- [x] Input validation via Pydantic on all endpoints
- [x] CSV file validation: .csv extension + MIME type + max 10MB
- [x] Role-based access control on all sensitive endpoints
- [x] SQL injection prevention via SQLAlchemy ORM

### Integrations
- [x] SMTP email (configurable: Gmail, SendGrid, etc.)
- [x] Telegram Bot API
- [x] WeasyPrint or ReportLab for PDF generation
- [x] openpyxl for Excel export
- [x] APScheduler for background jobs (monthly reports, nightly alerts)
- [x] n8n: via full REST API + outbound webhooks

---

## AGENTS

| Agent | Role | Works On |
|-------|------|----------|
| DATABASE-AGENT | Models + migrations | All 13 tables |
| BACKEND-AGENT | API + services | All 11 modules, CSV parser, cost calculator, yield calculator, notification service, webhook dispatcher |
| FRONTEND-AGENT | UI + pages | Dashboard, Printers, Column mapping editor, Toner Yield Report, Settings, Reports, Admin |
| DEVOPS-AGENT | Docker + scheduler | Docker Compose, APScheduler setup, SMTP + Telegram config |
| TEST-AGENT | Tests | Unit tests for cost/yield calculations, integration tests for CSV parser and API endpoints |
| REVIEW-AGENT | Code review + security | API key handling, webhook signing, role enforcement, file upload validation |

---

# READY?

```bash
/generate-prp INITIAL.md
```

Then:

```bash
/execute-prp PRPs/shadow-market-prp.md
```
