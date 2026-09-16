# CLAUDE.md — Interior Studio OS Rules

> Rules Claude follows in every conversation for **Interior Studio OS**.
> Built by **DigitalVetri** for client **The Interior Studio**.
> Source of truth for build decisions: `BUILD_GUIDE.md` (at repo root or `c:\Users\binu\Downloads\BUILD_GUIDE.md`).

---

## Project Overview

**Project Name:** Interior Studio OS
**Client:** The Interior Studio (Coimbatore, Tamil Nadu)
**Builder:** DigitalVetri — `info@digitalvetri.com`
**Description:** WhatsApp-first CRM + Project Management + ERP + AI Automation platform for interior design studios. Carries a project from the first Instagram DM to the final handover sign-off, tracking every rupee of margin in between.

**Tech Stack:**

- Framework: **Next.js 15 (App Router)** — server components first; client components only for interactivity
- Language: TypeScript 5.x (strict) — no `any` without `// reason:` comment
- Database: **Supabase** (Postgres + Row-Level Security + Auth + Storage + Realtime)
- ORM: **Drizzle ORM** (SQL-first; `interior-studio-os/src/lib/db/schema.ts`)
- Background jobs: **Inngest** (durable steps, event + cron)
- WhatsApp: **Meta WhatsApp Cloud API** (Graph API v21+, direct — no BSP)
- Payments: **Razorpay** (Payment Links + webhooks), abstracted via `lib/payments/`
- PDF: Playwright headless Chromium (BOQ/invoices) + `@react-pdf/renderer` (simple receipts)
- AI — text/voice: **Groq** (120B/20B + Whisper v3 Turbo) via `lib/ai/` abstraction
- AI — vision: **Gemini Flash** via same `lib/ai/` abstraction
- UI: Tailwind CSS + shadcn/ui
- Data fetching: TanStack Query (with offline outbox for PWA)
- Validation: Zod (shared client/server schemas in `src/types/`)
- Testing: Vitest (unit) + Playwright (E2E)
- Hosting: Vercel (preview per PR, prod on `main`)

> **Stack is locked.** Do NOT revert to FastAPI/React/Alembic patterns — the scaffold template's backend/ and frontend/ dirs are NOT part of this project.

---

## Project Structure

```
interior-ulagam/                    ← repo root (template/agent layer)
├── BUILD_GUIDE.md                  ← source of truth for all build decisions
├── PRPs/interior-studio-os-prp.md  ← PRP blueprint
├── agents/                         ← 14 agent definitions
├── skills/                         ← skill packs
├── rules/                          ← quality rules
├── interior-studio-os/             ← THE ACTUAL NEXT.JS APP (all code goes here)
│   ├── drizzle/                    ← migrations
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/        ← authed office UI (owner, designer, accountant)
│   │   │   │   ├── leads/
│   │   │   │   ├── projects/
│   │   │   │   ├── quotes/
│   │   │   │   ├── materials/
│   │   │   │   ├── accounts/
│   │   │   │   └── layout.tsx
│   │   │   ├── (field)/            ← PWA views for site supervisors
│   │   │   ├── p/[token]/          ← magic-link client Trust Timeline (no login)
│   │   │   ├── login/
│   │   │   └── api/
│   │   │       ├── webhooks/
│   │   │       │   ├── whatsapp/route.ts
│   │   │       │   └── razorpay/route.ts
│   │   │       ├── inngest/route.ts
│   │   │       └── health/route.ts
│   │   ├── lib/
│   │   │   ├── db/                 ← drizzle client + schema (20 tables)
│   │   │   ├── supabase/           ← server & client helpers (SSR-safe)
│   │   │   ├── whatsapp/           ← send templates, parse inbound, flows
│   │   │   ├── payments/           ← razorpay abstraction
│   │   │   ├── ai/                 ← provider-agnostic (groq + gemini)
│   │   │   │   ├── index.ts        ← single AIProvider interface
│   │   │   │   ├── groq.ts
│   │   │   │   └── gemini.ts
│   │   │   ├── pdf/                ← BOQ/quote/invoice PDF generators
│   │   │   └── auth/               ← role checks, tenant context
│   │   ├── inngest/
│   │   │   ├── client.ts
│   │   │   └── functions/          ← one file per automation
│   │   ├── components/             ← shared UI (shadcn + custom)
│   │   └── types/                  ← shared Zod schemas & TS types
│   ├── tests/
│   ├── public/                     ← PWA manifest, icons, service worker
│   ├── .env.example
│   ├── .env.local                  ← real values, git-ignored
│   └── package.json
```

> **All code for Interior Studio OS lives inside `interior-studio-os/`.** Never write app code outside that directory.

---

## Code Standards

### TypeScript (all code)

```typescript
// ALWAYS define interfaces — NO any types
interface QuoteLine {
  id: string;
  room: string;
  item: string;
  qty: number;
  unit: string;
  clientRatePaise: number;   // integers only — never floats
  costRatePaise: number;
  marginPaise: number;       // derived: (clientRate − costRate) × qty
  hsnSac: string;
}

// ALWAYS type async functions
const fetchLeads = async (tenantId: string): Promise<Lead[]> => { ... };

// ALWAYS use Server Components for data fetching
// async server component — no 'use client'
export default async function LeadsPage() {
  const leads = await getLeads();  // direct DB call
  return <LeadBoard leads={leads} />;
}
```

### Money rules

- **All monetary values stored as paise (integers) — NEVER floats**
- Format to rupees only at display layer: `(paise / 100).toLocaleString('en-IN')`
- Margin formula: `marginPaise = (clientRatePaise − costRatePaise) × qty`

### Database rules

- Every tenant-scoped query must filter by `tenant_id` in app code
- Inngest functions use service role key (bypasses RLS) — must pass `tenant_id` explicitly
- All amounts stored as paise integers

### AI rules

- NEVER import `groq-sdk` or `@google/generative-ai` from a feature module
- ALWAYS go through `lib/ai/index.ts` (single AIProvider interface)
- ALWAYS validate LLM output with Zod schemas
- ALWAYS require human-in-the-loop approval before client-facing quotes or invoices

### Payment rules

- `payments.status` written **ONLY** by Razorpay webhook — NEVER by UI
- Idempotency key: `razorpay_payment_id` (deduplicate on this)
- Manual override must write an audit trail row

---

## Forbidden Patterns

- `any` type → always define interfaces (allowed only with `// reason:` comment)
- `console.log` in production code → use `console.error` for errors only, remove debug logs
- Inline styles → use Tailwind classes
- Float for money → always paise integers
- Importing `groq-sdk` / Gemini directly in feature code → use `lib/ai/index.ts`
- Writing `payments.status` from UI code → webhook only
- Skipping `tenant_id` filter in DB queries
- Client component for data fetching when a server component works → server-first
- Hardcoded secrets → always `.env.local`, never committed
- `SELECT *` style queries → specify columns in Drizzle

---

## Role-Based Access Rules

| Role | Access |
|------|--------|
| `owner` | Full access: admin panel, all projects, P&L, accounts, settings |
| `designer` | Own projects, deliverables, site visits, quotes |
| `supervisor` | Field app only: site logs, snag items (identified by phone) |
| `accountant` | Accounts, invoices, payments, expenses (read + export) |

Clients have **no login** — they interact exclusively via WhatsApp and magic-link Trust Timeline (`/p/[token]`).

---

## Business Rules

### Margin engine
- `marginPaise = (clientRatePaise − costRatePaise) × qty` — generated column at DB level
- Shown per line, per room, and project total while quoting
- Approved quote cannot be edited — must create a new version (V+1)
- Material rate change on active quote → alert the quote owner

### WhatsApp
- Single-owner-per-thread: one user owns a lead's WhatsApp thread
- Media URLs from Meta expire in **~5 minutes** — download in the first Inngest step
- Utility templates are free inside the 24h service window — always prefer utility over marketing for transactional messages
- Follow-up nudge sequence must use Inngest `cancelOn` to stop when client replies

### Payments
- Milestone default split: 10% / 40% / 40% / 10%
- Overdue escalation: day 3 → client nudge; day 7 → client nudge 2; day 10 → owner alert
- Razorpay payment captured → webhook → reconcile → receipt → unlock next project stage

### Stage gates
- Procurement stage cannot open until: design approved AND milestone 2 paid
- Revision N+1 (beyond free cap) → auto-trigger change-order quote

### GST
- Works contract: 18% (9% CGST + 9% SGST intra-state; 18% IGST inter-state)
- Place of supply determines CGST+SGST vs IGST
- e-Invoice is a toggle (IRN/QR via GSP API)

### AI cost budget (per event)
- Owner brief: ~$0.003 (Groq 120B)
- Message parse: ~$0.0001 (Groq 20B)
- Whisper transcription: ~$0.04/hr audio
- Use Groq Batch API (50% off) for all-tenant Monday-brief run

---

## API Conventions

- Route handlers in `src/app/api/**`
- All app routes nested under `(dashboard)/` for authed routes
- Consistent response: server components use direct DB; API routes return JSON
- HTTP status codes:
  - 200: Success
  - 201: Created
  - 400: Bad Request
  - 401: Unauthorized (Supabase session missing)
  - 403: Forbidden (wrong role)
  - 404: Not Found
  - 422: Validation error (Zod)

---

## Environment Variables

All env vars live in `interior-studio-os/.env.local` (real values, git-ignored) and `interior-studio-os/.env.example` (committed, no secrets).

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only — bypasses RLS; treat like a password

# --- Database (Drizzle) ---
DATABASE_URL=                   # postgres connection string

# --- WhatsApp Cloud API ---
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=          # System User token (long-lived)
WHATSAPP_VERIFY_TOKEN=          # you invent; used for webhook handshake
WHATSAPP_APP_SECRET=            # to verify X-Hub-Signature-256

# --- Razorpay ---
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# --- AI ---
GROQ_API_KEY=
GOOGLE_AI_API_KEY=              # Gemini Flash for site photos

# --- Inngest ---
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# --- App ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> `NEXT_PUBLIC_` prefix = safe to expose to client. Everything else is server-only.

---

## Development Commands

```bash
# All commands run from interior-studio-os/
cd interior-studio-os

# Install
pnpm install

# Push Drizzle schema to Supabase
pnpm drizzle-kit push

# Dev (Next.js :3000 + Inngest in parallel)
pnpm dev
pnpm inngest-cli dev     # second terminal

# Tunnel for webhooks (WhatsApp + Razorpay)
npx ngrok http 3000

# Tests
pnpm vitest run
pnpm vitest run --coverage

# E2E
pnpm playwright test

# Lint + type check
pnpm lint
pnpm type-check

# Build
pnpm build
```

---

## Commit Message Format

```
feat(leads): add pipeline board with drag-between-stages
feat(quotes): add room-wise margin engine with live calculation
feat(milestones): add Razorpay webhook reconciliation
feat(ai): add Whisper site-log transcription via Groq
fix(webhooks): handle media URL expiry with immediate download step
test(margin): add unit tests for paise margin calculation
chore(schema): add GRN table with Drizzle migration
```

---

## Three-tier knowledge architecture

| Tier | Naming | Purpose | When Claude loads it |
|---|---|---|---|
| **Agent** | `agents/<domain>-agent.md` | WHO does the work | When orchestrator dispatches work |
| **Layer skill** | `skills/<DOMAIN>.md` (uppercase) | Domain-wide conventions | At session start when working in that domain |
| **Pattern skill** | `skills/<domain>-patterns/SKILL.md` | Task-specific recipes | Only when a specific task triggers its description |

## Skills Reference

| Task | Skill |
|------|-------|
| Database models + Drizzle | `skills/DATABASE.md` |
| API routes + Auth + Inngest | `skills/BACKEND.md` |
| Next.js UI + shadcn | `skills/FRONTEND.md` |
| Testing | `skills/TESTING.md` |
| Deployment | `skills/DEPLOYMENT.md` |

---

## Quality Commands

| Command | Purpose |
|---------|---------|
| `/tdd` | TDD workflow — write tests first |
| `/code-review` | Comprehensive code quality review |
| `/verify` | Build + lint + test + security check |
| `/build-fix` | Auto-fix build errors |
| `/security-review` | OWASP vulnerability scan |
| `/e2e` | Generate E2E tests |
| `/learn` | Extract patterns for next session |
| `/plan` | Implementation planning |

---

## Agent Coordination

| Agent | Role |
|-------|------|
| DATABASE-AGENT | Drizzle schema (20 tables), RLS policies, Supabase migrations |
| BACKEND-AGENT | Next.js API routes, lib/ (auth, whatsapp, payments, ai, pdf), Inngest functions |
| FRONTEND-AGENT | Next.js pages (dashboard, field, p/[token]), shadcn components, TanStack Query hooks |
| DEVOPS-AGENT | vercel.json, GitHub Actions CI, env wiring, webhook URL registration |
| TEST-AGENT | Vitest unit tests (margin, GST, payments), Playwright E2E |
| REVIEW-AGENT | Security audit (RLS coverage, webhook signatures, OWASP) |

---

## ECC Quality Enforcement Layer

Quality rules loaded from `rules/`:
- `rules/common/` — Security, testing, coding style, code review, git workflow, performance
- `rules/typescript/` — TypeScript coding style, patterns, security, testing, hooks

### Compliance skills (cross-cutting)

| Skill | Covers |
|-------|--------|
| `skills/security-review/gdpr-compliance.md` | GDPR consent, erasure, portability |
| `skills/security-review/pci-dss-compliance.md` | PCI DSS, webhook security |
| `skills/security-review/zero-trust-architecture.md` | Zero Trust, ABAC |
| `skills/security-review/dast-pen-testing.md` | DAST, API security tests |
| `skills/security-review/application-encryption.md` | AES-256-GCM, KMS |
| `skills/security-review/end-user-mfa.md` | MFA (Supabase Auth 2FA) |

Invoke via `/compliance-review` or `/security-review`.

---

## Behavioral guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- Surface tradeoffs; push back when warranted.

### 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- Touch only what you must. Match existing style.
- Don't "improve" adjacent code, comments, or formatting.
- If you notice unrelated dead code, mention it — don't delete it.

### 4. Goal-Driven Execution
- Transform tasks into verifiable goals before implementing.
- For multi-step tasks, state a brief plan with verify steps.
