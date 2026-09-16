# Shadow Market Template — Improvement Suggestions

> Honest assessment of the current template after reading it end-to-end. Ordered by impact.

The template has real strengths — the agent/skill/rules separation is mature, the PRP workflow is solid, the multi-platform rules (TypeScript/Python/Swift/Kotlin) show ambition. But there are gaps that will cost you time as you scale the agency.

Items marked **P0** are do-now-or-regret. **P1** is next sprint. **P2** is nice-to-have.

---

## P0 — Do these first

### 1. The template is named "PrintSight" throughout

**Problem:** `package.json`'s `name` is `printsight-frontend`. `PRPs/printsight-prp.md` is the only PRP. `CLAUDE.md` is titled "PrintSight Project Rules" and references PrintSight 20+ times. When you fork this for Swetha HRMS or LIVVLY, every clone starts as a PrintSight branch mentally.

**Why it hurts:** Claude Code reads these files literally. When it sees "PrintSight Project Rules" at the top of CLAUDE.md, it assumes the current project IS PrintSight. Every new client fork inherits that confusion.

**Fix:** Run the rename script (`rename-to-shadow-market.sh` from the earlier patch). Better: make the template CLAUDE.md use `{PROJECT_NAME}` placeholders and generate the real one on fork.

### 2. Missing brownfield mode (this patch)

**Problem:** Template assumes every task is a fresh PRP execution. No onboarding. No `/resume`. No memory across sessions.

**Why it hurts:** Every time you return to a client project, Claude starts from zero. It re-reads files it read yesterday, asks questions it asked last week, re-proposes architectures already decided.

**Fix:** This patch (`shadow-market-brownfield-patch/`). Install it.

### 3. `frontend/package.json` doesn't match `FRONTEND.md` — ✅ RESOLVED (2026-04-22)

**Was:** `FRONTEND.md` mentioned `framer-motion`, `gsap`, `lenis`, `three`, `split-type` but `package.json` didn't install them.

**Now:** All five libs + `@types/three` are in `frontend/package.json`. Scroll skills compile without manual installs.

### 4. Clutter in the repo root

Files currently in root that shouldn't be:
- `localhost` (empty file — probably a typo from `curl localhost > localhost`)
- `login-page.png` (a screenshot — belongs in `docs/` or a PR)
- `_gen_migration.py` (a script — belongs in `scripts/`)
- `put-all-the-phases-smooth-eclipse.md` (16KB file with an ambiguous name — what is this?)

**Why it hurts:** Every agent reading the root sees noise. New developers (and Claude) can't tell what's structural vs debris.

**Fix:**
```bash
rm localhost
mv login-page.png docs/
mv _gen_migration.py scripts/
# put-all-the-phases-smooth-eclipse.md — either delete or move to docs/ with a proper name
```

---

## P1 — Do within the next sprint

### 5. Skills are inconsistently formatted

**Observations from reading `skills/`:**
- Some have `origin: ECC` in frontmatter, others don't
- Some are uppercase files (`FRONTEND.md`, `BACKEND.md`), others are lowercase folders (`frontend-patterns/`, `api-design/`)
- Some frontmatter descriptions start with imperative ("Use for..."), others descriptive ("Frontend development patterns...")

**Why it hurts:** Claude Code uses the description for skill matching. Inconsistent description style → inconsistent activation. The uppercase-vs-lowercase split is also confusing — is `FRONTEND.md` different from `frontend-patterns/`?

**Fix:**
- Pick ONE convention for naming — I recommend lowercase-dir-with-SKILL.md (matches Claude Code's native convention)
- Migrate `FRONTEND.md` → `skills/frontend/SKILL.md` (rename, merge with `frontend-patterns/` if they overlap)
- Same for `BACKEND.md`, `DATABASE.md`, `DEPLOYMENT.md`, `TESTING.md`
- Normalize frontmatter — all descriptions should be imperative and start with the trigger condition
- Drop `origin: ECC` if it has no meaning (or document what it means)

### 6. `agents/` vs `skills/` confusion

**Problem:** `frontend-agent.md` exists alongside `frontend-patterns/SKILL.md` and `FRONTEND.md`. Three "frontend" things. An agent, a pattern skill, a layer skill.

A new contributor (human or AI) cannot tell:
- Which one gets activated when
- Whether to put knowledge in agent vs skill
- Why the split exists

**Fix:** Document the split explicitly. My read of your intent:
- **agents/** = WHO does work (personas, orchestration rules)
- **skills/** = WHAT knowledge they use (patterns, conventions)
- **rules/** = CONSTRAINTS they must obey (style, security, testing)

Add this mental model at the top of `README.md`. Then audit — are all three consistent with that split today? (Spoiler: they're mostly consistent, but `frontend-agent.md` duplicates some skill content.)

### 7. No brand/design-system layer

**Problem:** Every new fork of this template has to rebuild typography, colors, spacing tokens, and UI primitives from scratch. There's no `skills/brand/SKILL.md` or `frontend/src/styles/tokens.ts` with Shadow Market defaults.

**Why it hurts:** Client projects drift aesthetically because each fork starts from shadcn defaults. Your ₹7Cr case study looks like every other SaaS on the internet.

**Fix:** Add a `skills/shadow-brand/SKILL.md` with:
- Color tokens (your orange/red/gold/white as CSS vars)
- Typography stack (display serif, body sans, mono)
- Spacing scale
- Radius scale
- Shadow scale

Plus a `frontend/src/styles/tokens.css` that ships with every fork. Tailwind picks these up via `theme.extend`.

### 8. No MCP configuration for the template

**Problem:** `.claude/settings.local.json` only has Playwright MCP permissions. No Coolify, no n8n, no Hostinger, no Razorpay — all things your projects hit.

**Why it hurts:** Every new client fork, you manually add MCP servers. Ten forks = ten manual setups.

**Fix:** Add a template `.mcp.json` at repo root with (commented-out) blocks for the common MCPs you use. New forks uncomment and fill in credentials. You already have `.mcp.json` — expand it.

### 9. Agent definitions are thin

**Problem:** `frontend-agent.md` is mostly a pointer to skills. It doesn't teach Claude how to BE the frontend agent — just what files to read.

**Example gap:** When the frontend-agent gets a bug report, what's its debugging process? Which browser DevTools commands does it know to run? How does it decide between a state bug vs render bug vs style bug? The agent file doesn't say.

**Fix:** For each agent, add sections:
- **My debugging flow** (step-by-step)
- **My decision rules** (when X vs Y)
- **What I will refuse to do** (explicit scope limits)
- **Signals I escalate to the user on** (specific trigger conditions)

Make agents real personas, not skill-lists.

### 10. No observability / progress tracking

**Problem:** Long-running agent tasks produce text output only. No structured progress. No "I'm on step 3 of 7" log file.

**Why it hurts:** If a task crashes mid-way, you restart from zero. If a task succeeds but you're away from the terminal, you have no summary.

**Fix:** Agents write a `.claude/session-log-YYYY-MM-DD-HHMMSS.md` for every meaningful run. Structured as:
- Goal
- Steps planned
- Steps completed / skipped / failed
- Files touched
- Decisions made
- Next recommended action

Commit session logs periodically. They're retrospective for you AND context for future Claude sessions.

---

## P2 — Nice to have

### 11. Multi-platform rules you probably aren't using

**Problem:** `rules/swift/`, `rules/kotlin/` exist. Your current client stack (from memory) is Node.js, Python, Next.js, FastAPI — no native mobile.

**Why it hurts:** Not much, but they bloat the repo and Claude reads them sometimes.

**Fix:** Decide — are you going to do native mobile work? If yes, keep. If no, delete the rules and the `swift-*`, `kotlin-*`, `android-*`, `compose-multiplatform-patterns` skills. They're dead weight.

### 12. No "fork for new client" script

**Problem:** Every new client project = manual clone, rename, strip PrintSight-specific code, reset git history.

**Fix:** Add `scripts/fork-for-client.sh`:

```bash
./scripts/fork-for-client.sh <client-name> <client-slug>
# Creates a new repo
# Replaces all placeholders with client name
# Generates a fresh .claude/project-state.md
# Clears the example PRP
# Commits as "Initial Shadow Market fork for <client>"
```

Saves ~30 min per new client. You have 10 clients; that's 5 hours already.

### 13. No test-per-skill

**Problem:** Skills are markdown. There's no way to verify "when I prompt X, does skill Y activate?" without actually testing in Claude Code.

**Fix:** Anthropic has a skill-creator skill with eval support. For P2, add skill evals for at least the top-5 most-used skills. Optional but valuable.

### 14. PRPs aren't versioned

**Problem:** `printsight-prp.md` has rev 1.1 and 1.2 notes inline. When a PRP evolves, you're editing one file instead of versioning it.

**Fix:** Either:
- Git tag PRPs (`git tag prp/printsight-v1.0`)
- Or number them as separate files (`PRPs/printsight/v1.0.md`, `v1.1.md`)

For short-lived PRPs this doesn't matter. For ones that ship, it does.

### 15. No CI check for the skills

**Problem:** `.github/workflows/ci.yml` runs backend + frontend tests. Doesn't validate skills, agents, or rules files.

**Fix:** Add a lint step:
- Every `skills/*/SKILL.md` has valid frontmatter with required fields
- Every `agents/*.md` has valid frontmatter
- No orphan skill references (agent mentions a skill that doesn't exist)
- No broken paths in CLAUDE.md or README

Small lint script. Catches drift as skills evolve.

---

## Strategic suggestions

These are bigger than fixes — direction questions for you to decide.

### A. Should this template be the master for ALL Shadow Market projects, or just SaaS dashboards?

Right now it's shaped like a SaaS dashboard template (FastAPI + React + SQLAlchemy). For marketing sites it's overkill — no backend needed, just Next.js or Vite + static hosting.

**Option 1:** Keep one template, let the backend be optional (conditional flags on fork)
**Option 2:** Split into two templates — `shadow-saas-template` and `shadow-marketing-template`

I'd do Option 2. Marketing sites ship differently (Vercel/Netlify), have different SEO concerns, different performance budgets. Forcing them through a SaaS template drags them down.

### B. Your skills library is growing; do you need skill categories?

You have 20+ skills now. At 50 you'll need organization. Consider grouping:

```
skills/
├── layers/           # FRONTEND, BACKEND, DATABASE, DEPLOYMENT (the layer knowledge)
├── patterns/         # frontend-patterns, api-design, python-patterns (HOW to build)
├── quality/          # security-review, coding-standards, e2e-testing (reviewers)
├── platforms/        # swift-*, kotlin-*, flutter-* (if you keep them)
├── shadow/           # shadow-3d-scroll, shadow-brand, shadow-market-prompt (your originals)
└── workflows/        # brownfield-patterns, continuous-learning-v2
```

Flatter is fine now. Plan for groups by the time you hit 40.

### C. Memory beyond project-state.md

A single markdown file captures state within a project. But cross-project memory — "on Swetha last month I solved this auth bug, could reuse the approach" — doesn't live anywhere.

Two options:
1. **Obsidian vault** at `~/shadow-market-notes/` that you grep manually
2. **A private Claude Project** with memory enabled — attach it to your Claude.ai account, dump cross-project learnings into it

Recommend Option 2. You already have Claude memory. Feed it deliberately.

### D. Client onboarding vs developer onboarding

The template teaches *Claude Code* to onboard itself (this patch). But your clients also need onboarding to a deployed project — admin credentials, how to add users, where to see analytics.

Consider: every client project ships with `docs/client-onboarding.md` as a fillable template. Not code-facing; human-facing. But it lives in the same repo, so it stays current.

---

## Priority summary

| Do now (P0) | Next sprint (P1) | Someday (P2) |
|---|---|---|
| Run rename script | Standardize skill format | Delete unused mobile rules |
| Install brownfield patch | Add brand tokens | Fork-for-client script |
| Fix package.json / FRONTEND.md mismatch | Expand `.mcp.json` template | PRP versioning |
| Clean repo root | Deeper agent definitions | Skill CI lint |
| | Session logs | |

If you do only the P0 items, the template goes from "mature but client-specific" to "actually ready to be your master." That's 2–3 hours of work.
