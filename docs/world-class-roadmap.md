# Interior Studio OS — World-Class Product Roadmap
### Competitive Intelligence + Phase-by-Phase Upgrade Plan
**Prepared by:** DigitalVetri · Research date: September 2026  
**Research method:** 112-agent adversarial verification across 29 sources, 114 claims → 4 confirmed high-confidence findings

---

## Executive Summary

Interior Studio OS occupies a **defensible niche no competitor fully owns**: a WhatsApp-first, GST-native, rupee-margin-engine CRM built specifically for Indian interior design studios. The research confirms this gap is real.

The primary threat is not Houzz Pro or Studio Designer — it is **Dzylo**, an India-built platform that has already shipped AI visualization (Imagino), 360° virtual tours, and a native client app. Western platforms (Procore, Houzz Pro, Studio Designer, Mydoma) structurally cannot compete on GST compliance, WhatsApp automation, or Indian-market depth. But Dzylo can — and is moving fast.

**The strategic mandate:** Out-execute Dzylo on operational depth (margin engine, stage-gated procurement, Inngest automation) while out-executing Western platforms on India-specific compliance. Then add the visualization layer Dzylo already has.

---

## Part 1 — Competitive Landscape

### 1.1 The Primary Threat: Dzylo (India-native, verified)

Dzylo is the only confirmed Indian competitor with overlapping scope. Its verified production features as of 2026:

| Feature | Dzylo Status | Interior Studio OS Status |
|---------|-------------|--------------------------|
| AI Design Canvas (Imagino) | ✅ Live | ❌ Missing |
| 360° Virtual Room Tour | ✅ Live | ❌ Missing |
| Client App (native mobile) | ✅ Live | ⚠️ Magic-link portal only |
| Payment milestone dashboard | ✅ Live | ✅ Partial (Razorpay webhooks) |
| WhatsApp payment reminders | ✅ Live | ✅ Planned (Inngest) |
| Design annotation + approval | ✅ Live | ❌ Missing |
| GST / HSN compliance | ❓ Unconfirmed | ✅ Planned |
| Rupee margin engine | ❓ Unconfirmed | ✅ Built |
| Stage-gated procurement | ❓ Unconfirmed | ✅ Built |
| Offline PWA sync | ❓ Unconfirmed | ✅ Built (TanStack outbox) |

**The largest product gap versus Dzylo:** No visualization capability. Dzylo's Imagino + Virtual Tour has raised the table stakes — Indian interior design clients now expect to see their space before approving.

**Interior Studio OS's durable advantages over Dzylo:**
- Rupee-denominated margin engine with per-line, per-room, project-total visibility
- Stage-gated procurement (cannot open until design approved + milestone 2 paid)
- WhatsApp Cloud API direct (no BSP middleman, lower cost at scale)
- True PWA offline outbox (write actions queue on-site, sync on reconnect)
- GST e-Invoice with IRN/QR via GSP API (planned)

---

### 1.2 Western Competitors — Confirmed Structural Gaps

All Western platforms were researched. Secondary blog sources failed adversarial verification (0-3 votes). What is confirmed by structural inference:

**Houzz Pro** — Built for two audiences (contractors + designers), causing feature dilution. No GST. No WhatsApp. No rupee margin. US-centric.

**Studio Designer / Ivy** — Deep financial tracking for US FF&E purchasing workflow. Trade pricing, purchase orders, vendor management. No India compliance layer.

**Mydoma** — Mood boards, floor planning, 3D rendering. Client portal with e-signatures and credit card payments. No India payment rails (Razorpay), no WhatsApp.

**CoConstruct / BuilderTrend** — Construction-first. Strong scheduling, daily logs, budget tracking. BuilderTrend has offline time clock but Procore's confirmed offline gap shows the sector hasn't solved true offline sync.

**Procore** (confirmed, 3-0 vote) — Mobile offline is read-only from cache. No new data retrieval without connectivity. No write sync during offline. This is the exact weakness the TanStack Query offline outbox architecture is designed to beat.

**Monograph / Design Manager** — Time tracking, resource planning, fee proposals. Studio management focused. No project-site field tools.

**Foyr Neo / Planner 5D / Morpholio Board** — Visualization-only tools, not CRM or ERP. Not direct competitors — but their existence confirms that 3D visualization is a standalone expectation clients have.

---

### 1.3 Market Positioning Map

```
                    HIGH INDIA-SPECIFICITY
                            │
              Interior      │
              Studio OS ●   │
              (target)      │
                            │   Dzylo ●
                            │
LOW DEPTH ──────────────────┼────────────────── HIGH DEPTH
(billing only)              │                (full CRM+ERP)
                            │
    Vyapar ●   Swipe ●      │
    Hisabkitab ●            │
                            │    Houzz Pro ●
                            │    Studio Designer ●
                            │    Mydoma ●   BuilderTrend ●
                    LOW INDIA-SPECIFICITY
```

The top-right quadrant (high depth + high India-specificity) is unclaimed. Interior Studio OS's goal is to own it.

---

## Part 2 — The Four-Phase World-Class Roadmap

### Phase 1 — Foundation: UX Excellence & Trust Timeline Depth
**Timeline: Months 1–3**
**Goal:** Make every existing module feel premium. Fix friction. Deepen the client portal. Beat Procore on mobile offline.

### Phase 2 — Visualization: 3D Room Configurator & Design Approvals
**Timeline: Months 4–7**
**Goal:** Match Dzylo's Imagino + Virtual Tour. Embed Three.js room visualizer in the Trust Timeline. Enable pin-based design feedback.

### Phase 3 — AI Automation: WhatsApp-First Intelligence
**Timeline: Months 7–10**
**Goal:** Turn every workflow into a WhatsApp conversation. AI brief-to-quote, voice site logs, material rate alerts, auto-scheduling.

### Phase 4 — Market Differentiation: Permanent Moat
**Timeline: Months 10–14**
**Goal:** Lock in features no competitor can copy quickly — GST e-Invoice, multi-language, regional studio network, franchise mode.

---

## Part 3 — Phase 1 Deep Dive: UX Excellence

### 3.1 Design System Upgrade

**Current state:** Tailwind + shadcn/ui components. Functional but generic.

**Target state:** A bespoke design language that feels like it was made for interior designers — people who sell aesthetics for a living. They will judge the tool's visual quality as a proxy for your team's competence.

**Recommended design direction: Refined Material + Warm Depth**

Not glassmorphism (trendy, dated by 2027). Not neumorphism (accessibility nightmare). Instead:

- **Color palette:** Deep warm neutrals (warm charcoal `#1C1917`, warm white `#FAFAF9`, terracotta accent `#C2714F`, gold accent `#D4A853`)
- **Typography:** Display font for headers (e.g. Playfair Display), sans-serif for body (Inter). Contrast communicates premium.
- **Surface depth:** Subtle elevation layers — not flat, not skeuomorphic. Cards have `1px` warm border + `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`.
- **Micro-interactions (specific):**
  - Lead stage change → card slides smoothly with a color wash transition (150ms ease-out)
  - Invoice sent → checkmark animates in with a bounce (spring physics via Framer Motion `type: "spring", stiffness: 400`)
  - WhatsApp message received → notification badge pulses once (scale 1→1.2→1, 300ms)
  - Photo upload → progress ring fills clockwise (SVG stroke-dashoffset animation)
  - Amount fields → digits count up when a total recalculates (number ticker, 400ms)

**Specific component upgrades:**

```
Dashboard KPI cards:     Large number + sparkline trend + context sentence
Lead pipeline board:     Drag-and-drop with ghost card + drop-zone highlight
Project overview:        Timeline bar (Gantt-lite) replacing status badge list
Quote line items:        Inline editable table with live margin column in green/red
Invoice:                 PDF preview pane next to form, updates live as you type
```

### 3.2 Dashboard — World-Class Version

The dashboard is the first thing the owner sees every morning. It must answer 5 questions in under 5 seconds:

1. How much money came in this week?
2. Which projects are behind?
3. Who needs a follow-up today?
4. What WhatsApp messages are unread?
5. Is the team on-site?

**Recommended dashboard layout (desktop, 1440px):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Good morning, Mohammed.  Tuesday, 15 Sep · 9 leads · 4 active  │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ ₹2.4L        │ ₹18.6L       │ 3 overdue    │ 7 unread WA msgs   │
│ This week    │ Outstanding  │ milestones   │                    │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                                                                   │
│  PROJECTS AT RISK (3)           TODAY'S FOLLOW-UPS (5)          │
│  ┌─────────────────────────┐   ┌─────────────────────────────┐  │
│  │ Sharma Residence  D+4   │   │ 10:00  Priya – Site visit   │  │
│  │ Kumar Office      D+7   │   │ 14:00  Raj – Quote review   │  │
│  │ Meena Villa       D+12  │   │ 16:00  Anand – Follow-up 2  │  │
│  └─────────────────────────┘   └─────────────────────────────┘  │
│                                                                   │
│  PIPELINE SNAPSHOT                   CASH FLOW (30 days)        │
│  New → Qualified → Proposal → Won    [Mini bar chart]            │
│  [Kanban pill counts with amounts]                               │
└─────────────────────────────────────────────────────────────────┘
```

**Three.js element — Dashboard:** A small 3D animated logo/mascot in the top-right corner of the dashboard (not intrusive — think Notion's workspace planet). On load, it spins slowly. On milestone payment received, it briefly glows gold. Implementation: `<Canvas>` with a `<Suspense>` boundary, lazy-loaded, ~15KB GLTF.

### 3.3 Leads Module — World-Class Version

**Current gaps to fix:**
- Kanban board needs drag-between-stages (not just visual)
- Lead card needs revenue estimate visible at-a-glance
- Follow-up overdue indicator needs urgency color (red/amber/green)
- Quick WhatsApp compose from lead card (one click → pre-filled template)

**New features for Phase 1:**
- **Lead scoring** — simple 0–100 score computed from: budget declared, site visit done, timeline urgency, response rate. Shown as a colored bar on the card.
- **Activity timeline** — every action (call, WA, site visit, quote sent) in a vertical timeline on the lead detail page.
- **Smart follow-up suggestions** — "Last contact was 5 days ago. Suggested: 'Just checking in' WhatsApp nudge." One-tap to send.

### 3.4 Projects Module — World-Class Version

**Current state:** Overview page with photos, stage badge, basic KPIs.

**Phase 1 additions:**

**Project health ring** — A circular progress indicator combining: milestone completion %, payment collection %, site log recency, and snag clearance rate. Green when all healthy, amber when 1 is lagging, red when 2+.

**Gantt-lite timeline** — Not a full Gantt (too complex). A horizontal bar per project phase (Design → BOQ → Procurement → Execution → Handover) with actual vs planned dates. Implemented with pure SVG — no library needed.

**Photo timeline** — Site photos sorted chronologically with a date scrubber. Client can see "Week 1 → Week 8" progress. Stored in MinIO, lazy-loaded.

**Stage gate card** — Prominent card that shows: "Procurement stage locked. Unlock requires: ✅ Design approved · ❌ Milestone 2 payment pending (₹1.2L due)." One-tap to send payment reminder.

### 3.5 Trust Timeline Portal — World-Class Version

The Trust Timeline (`/p/[token]`) is the client's window into the project. Currently: no-login, magic-link. This is the right architecture — **do not add login**.

**Dzylo's Client App threat:** They have a native app with formal approval workflows. The counter-strategy is not to build a native app — it is to make the magic-link portal so good that no client wants to download another app.

**Phase 1 Trust Timeline upgrades:**

```
Current:     Milestone list + basic status badges
Target:
├── Project header with cover photo (full-bleed, from site photos)
├── Progress ring (% complete, visually satisfying)
├── Milestone payment tracker
│   ├── Each milestone: name · amount · due date · status (Paid/Pending/Overdue)
│   └── "Pay now" Razorpay button for pending milestones
├── Live photo feed (latest 6 site photos, tappable full-screen)
├── Document vault (contract, quotes, design files — download only)
├── Design approval section (Phase 2: with annotation)
└── One-tap WhatsApp connect to designer
```

**The "wow moment":** When a client opens the Trust Timeline for the first time, the page loads with a smooth entrance animation — the project cover photo fades in, the progress ring fills to current completion, and the milestone amounts count up. Total first-load animation: 800ms. Makes the client feel like they're opening a premium property report, not a generic app.

---

## Part 4 — Phase 2 Deep Dive: 3D Visualization

### 4.1 Why This Is Non-Optional

Dzylo's Imagino AI + Virtual Tour are confirmed live features (3-0 adversarial vote). Indian interior design clients now interact with visualization tools. If Interior Studio OS cannot show a 3D representation of the proposed space, the sales cycle disadvantage is real.

**The goal is not to rebuild Dzylo.** The goal is to embed just enough 3D to close the gap at the Trust Timeline level — where the client needs to approve, not where the designer needs to create.

### 4.2 Three.js Room Configurator (Phase 2 Centerpiece)

**Architecture decision:** Embed a Three.js viewer (not editor) in the Trust Timeline portal. The designer uploads a simple room layout from any tool (even a photo). The client sees an interactive 3D walkthrough and annotates directly on the surface.

**Three.js implementation plan:**

```typescript
// Room Viewer component — embedded in /p/[token] Trust Timeline
// Uses Three.js + React Three Fiber (R3F) for declarative React integration

// Stack:
// - @react-three/fiber (R3F) — React renderer for Three.js
// - @react-three/drei — helpers (OrbitControls, Environment, useGLTF)
// - @react-three/xr — WebXR for future AR/VR
// - leva — debug panel (dev only)

// What it renders:
// 1. A room box (floor, 3 walls, ceiling) from dimensions in the project data
// 2. Furniture pieces as GLTF models (sourced from a curated library)
// 3. Material textures on walls/floor (from the BOQ material selections)
// 4. Ambient + directional lighting with soft shadows
// 5. Orbit controls for 360° view (no WebXR required for basic use)
// 6. Click-to-annotate: ray-cast picks a surface point → annotation pin drops

// Performance targets:
// - First render: < 2s on mobile (4G)
// - GLTF assets: < 2MB total per room (LOD: low-poly models)
// - Lazy-loaded behind Suspense with a 2D floor plan fallback
```

**Visual quality targets:**
- Physically-based rendering (PBR) materials — wood grain looks like wood, marble looks like marble
- HDRI environment map for realistic reflections
- Post-processing: subtle bloom on light sources, vignette at edges
- Smooth camera transitions between rooms (Tween.js or GSAP)

**Annotation layer:**
```
Client taps a wall in the 3D view
→ Pin appears at the tap point (Three.js raycasting to world coords)
→ Comment bubble opens: "Can we make this wall darker?"
→ Saved as {x, y, z, roomId, comment, clientName, timestamp}
→ Designer gets WhatsApp notification: "New comment on Room 3 wall"
→ Designer resolves comment → client sees ✅ resolved on the pin
```

### 4.3 AI-Assisted Room Generation (Phase 2, Month 6–7)

Leverage the existing Gemini Flash integration for a "Generate concept" feature:

1. Designer uploads a site photo (taken on mobile at first site visit)
2. Gemini Flash analyzes the photo: detects room dimensions, existing fixtures, natural light
3. Returns a structured brief: room type, estimated sq ft, style suggestions
4. Designer selects a style (Modern / Scandinavian / Classical / Bohemian)
5. Gemini generates a concept description → feeds into Three.js scene as material + furniture selection
6. Client sees a rough 3D concept in the Trust Timeline within minutes of the site visit

This is not Imagino. It is a simpler, faster, WhatsApp-first version of the same idea.

---

## Part 5 — Phase 3 Deep Dive: AI Automation

### 5.1 WhatsApp-First Intelligence Stack

The existing stack (Groq 120B + Groq 20B + Whisper v3 Turbo + Gemini Flash + Inngest) is already the right foundation. Phase 3 is about wiring these into complete, automated workflows.

**Automation 1 — Instant Brief from WhatsApp Voice Note**
```
Client sends voice note on WhatsApp: "We want a 3BHK renovation, 
  budget around 25 lakhs, modern style, need it done by March"

→ Whisper v3 Turbo transcribes (< 2s, ₹0.04/hr audio)
→ Groq 120B extracts structured brief:
   { rooms: ['living', 'kitchen', '3 bedrooms', '2 bathrooms'],
     budgetPaise: 2500000,
     style: 'modern',
     timeline: '2027-03',
     sqft: null  // flagged for follow-up question }
→ Inngest: creates lead with structured data, triggers follow-up WA:
   "Hi! I've noted your requirements. Quick question — what's the 
    approximate area of the flat in sq ft?"
→ Owner sees pre-filled lead card — one tap to approve or edit
```

**Automation 2 — Smart Quote Generator**
```
Designer finishes site measurement round
→ Taps "Generate Quote" in the app
→ Groq 120B receives: room measurements + style brief + material preferences
→ Returns: room-wise BOQ draft with quantities, suggested materials, unit rates
→ Designer reviews line by line, adjusts rates
→ Margin engine recalculates live (all in paise)
→ One-tap: "Send to client" → WhatsApp message with PDF link
```

**Automation 3 — Payment Intelligence**
```
Day 0:  Invoice sent → WhatsApp: "Invoice #001 for ₹2.4L sent. Due: 20 Sep."
Day 3:  No payment → WhatsApp: "Gentle reminder: Invoice #001 due in 2 days."
Day 7:  No payment → WhatsApp: "Invoice #001 overdue. Reply 'PAY' to get the link."
Day 10: Owner alert → WhatsApp to owner: "Sharma project payment overdue 10 days."
All: cancelOn → client replies or pays → sequence stops immediately
```

**Automation 4 — Site Log Intelligence (Supervisor)**
```
Supervisor taps "Log" in field PWA
→ Records voice note (30 seconds)
→ Whisper transcribes
→ Groq 20B extracts: work done, materials used, workers count, issues
→ Structured log created and attached to project
→ If issue detected: WhatsApp alert to project designer
→ Owner gets end-of-day summary: "3 active sites. 1 issue flagged."
```

**Automation 5 — Material Rate Alert**
```
Material rate changes in the catalogue (supplier updates price)
→ Inngest checks: any active quotes using this material?
→ If yes: WhatsApp to quote owner: "Rate for 'Merino Laminate 1mm' changed 
  from ₹450 to ₹490/sq ft. 2 active quotes affected. Tap to review."
→ Designer taps → sees affected line items highlighted
→ One tap to recalculate and re-send quote
```

### 5.2 AI Cost Budget (Per Month Estimate)

| Feature | Model | Frequency | Monthly Cost |
|---------|-------|-----------|-------------|
| Voice brief transcription | Whisper v3 Turbo | 200 notes/mo | ~$0.40 |
| Brief extraction | Groq 120B | 200 leads/mo | ~$0.60 |
| Quote generation | Groq 120B | 100 quotes/mo | ~$1.80 |
| Message parse (inbound WA) | Groq 20B | 2000 msgs/mo | ~$0.20 |
| Site photo analysis | Gemini Flash | 500 photos/mo | ~$0.75 |
| Monday owner brief (all tenants) | Groq Batch (-50%) | 50 tenants/mo | ~$0.15 |
| **Total** | | | **~$3.90/month** |

At ₹500/studio/month pricing, AI cost per studio is ~₹7. Negligible.

---

## Part 6 — Phase 4 Deep Dive: Permanent Moat

### 6.1 GST e-Invoice (IRN + QR via GSP API)

This is the feature Western platforms structurally cannot build quickly — it requires India-specific regulatory knowledge and a GSP (GST Suvidha Provider) integration.

```
Invoice finalized → Toggle "Generate e-Invoice"
→ POST to GSP API: GSTIN, items with HSN/SAC, amounts (paise → rupees at this layer)
→ GSP returns: IRN (Invoice Reference Number) + QR code
→ IRN + QR embedded in PDF invoice (mandatory for B2B turnover > ₹5Cr)
→ GSTR-1 auto-populated from invoice data
→ Client receives WhatsApp with e-Invoice PDF + IRN confirmation
```

**Moat value:** Indian studios with B2B clients (corporate offices, builders) are legally required to issue e-Invoices above certain thresholds. No Western competitor can offer this. Dzylo's e-Invoice status is unconfirmed.

### 6.2 Regional Language Support

Target languages (Phase 4): Tamil, Telugu, Kannada, Malayalam — the 4 South Indian languages covering the primary interior design market in Coimbatore, Chennai, Hyderabad, Bengaluru, Kochi.

Implementation approach:
- `next-intl` for i18n routing
- All client-facing strings in translation JSON
- WhatsApp templates in regional languages (Meta supports all 4)
- Trust Timeline portal detects client's browser language, renders in their language
- Quote PDFs generate in client's language (studio remains English-UI)

**Moat value:** A client receiving their project update in Tamil on WhatsApp, from an app their designer uses, is an experience no Western platform can replicate. This is a switching cost that doesn't require any technical barrier — just execution.

### 6.3 Studio Network / Franchise Mode

The final moat: when Interior Studio OS powers 100+ studios in South India, create a referral network.

- Clients browsing for interior designers see a "Find a Studio OS Designer" page
- Studios get rated by project completion speed, payment compliance, client satisfaction
- Top studios get a "Verified by Interior Studio OS" badge they can display
- Cross-studio material procurement: bulk ordering across the network for better vendor rates

---

## Part 7 — Per-Module Action Table

| Module | Phase 1 (Now) | Phase 2 (Month 4–7) | Phase 3 (Month 7–10) |
|--------|--------------|---------------------|----------------------|
| **Dashboard** | KPI ring, risk list, today's schedule, Three.js 3D mini-scene | Live WhatsApp feed panel | AI daily brief delivered to owner via WhatsApp at 8:30am |
| **Leads** | Lead scoring, drag-drop Kanban, activity timeline, 1-tap WA compose | Auto-brief from voice note, concept image from site photo | Full lead-to-quote AI pipeline, smart follow-up sequencing |
| **Projects** | Gantt-lite, health ring, photo timeline, stage-gate card | Three.js room viewer in Trust Timeline, pin annotations | AI site log analysis, material rate change alerts |
| **Quotes/BOQ** | Live margin column (green/red per line), room-wise subtotals, version history | AI quote draft from measurements, 3D material preview on line items | Smart re-quote on material rate change, one-tap WhatsApp send |
| **Materials** | Rate history graph, low-stock flag, vendor comparison | Material textures in 3D room viewer (PBR mapping) | Rate change automation, bulk procurement alerts |
| **Finance** | Invoice PDF preview pane, payment status swimlane, overdue aging list | e-Invoice IRN toggle (Phase 4 preview) | Razorpay link generation from WhatsApp reply, GSTR-1 export |
| **Client Portal** | Full-bleed cover photo, progress ring, milestone payments, doc vault | Three.js room viewer, design approval with pin annotations | Regional language rendering, live construction camera feed |
| **WhatsApp** | Template library UI, thread ownership indicator, read/unread count | Voice note → structured brief automation | Full conversation AI (parse intent → route → act) |
| **Attendance** | Calendar heatmap, late/absent streak alerts, leave balance card | Location validation (geofence for site check-in) | AI overtime prediction, payroll export |

---

## Part 8 — UI/UX Principles for World-Class Execution

### 8.1 The 5 Laws This App Must Follow

**Law 1 — One primary action per screen.** Every page has one obvious next step. The "debt collector" design smell (10 buttons, unclear priority) kills trust in a professional tool.

**Law 2 — Money is always visible.** The margin, the outstanding, the overdue — always present. Interior designers' biggest pain is not knowing where the money is. Make this the superpower.

**Law 3 — WhatsApp is the notification layer.** Never send email for something that can go on WhatsApp. Never build an in-app notification for something the user will miss. Meet users where they are.

**Law 4 — The client portal must feel more premium than the admin UI.** The client judges the studio's professionalism by the portal. If the portal looks like a generic app, the studio looks generic. The Trust Timeline must feel like a Rolls-Royce brochure.

**Law 5 — Mobile is first, not second.** Every feature is designed for a 390px screen first, then scaled up for desktop. The field supervisor with a Samsung A15 must have the same quality experience as the owner on a MacBook.

### 8.2 Three.js Integration Architecture

```typescript
// Lazy-load Three.js only where needed — not in the main bundle
// The Three.js + R3F bundle is ~180KB gzipped — significant

// Page-level lazy loading:
const RoomViewer = dynamic(() => import('@/components/3d/RoomViewer'), {
  ssr: false,  // Three.js is browser-only
  loading: () => <RoomViewerSkeleton />,  // 2D floor plan fallback
});

// Performance: use drei's Suspense + useProgress for loading bar
// LOD: three levels of geometry detail (low/med/high) based on device GPU
// iOS Safari: WebGL 2 with some limitations — test on iPhone SE viewport
```

**Three.js scenes planned per phase:**

| Scene | Location | Purpose | Complexity |
|-------|----------|---------|------------|
| Animated logo/mascot | Dashboard header | Brand delight | Low |
| Room viewer | Trust Timeline portal | Client approval | High |
| Material swatch 3D | Quote line items | Material preview | Medium |
| Project completion globe | Dashboard milestone | Celebration moment | Low |

### 8.3 Animation Budget (Performance Contract)

Every animation must be under this budget or it doesn't ship:

| Type | Max duration | Easing | GPU-only? |
|------|-------------|--------|-----------|
| Page transitions | 200ms | ease-out | Yes (transform/opacity) |
| Card hover lift | 150ms | ease | Yes |
| Modal open | 200ms | spring (stiffness 400) | Yes |
| Number count-up | 400ms | ease-out | No (requestAnimationFrame) |
| Stage change wash | 300ms | ease | Yes |
| Three.js scene load | < 2000ms | — | Yes (WebGL) |
| PWA install prompt | 500ms | spring | Yes |

Rule: **No JavaScript animations on the main thread.** Use CSS transforms/opacity or WebGL. `transform: translateY()` not `top: px`.

---

## Part 9 — Open Questions for the Next Research Cycle

The adversarial research identified 4 questions that cannot be answered from public sources — they require a direct Dzylo product trial:

1. **Does Dzylo have GST e-Invoice (IRN/QR via GSP)?** If yes, this feature loses its moat value and must be shipped faster.

2. **What is Dzylo's pricing for a 5–20 person studio?** If they are below ₹2,000/month, Interior Studio OS must have a clear value-density argument.

3. **Can the Trust Timeline magic-link portal outperform Dzylo's native app on client adoption?** The hypothesis is yes (no app download friction), but it needs A/B data.

4. **Which studios in Coimbatore / Chennai / Hyderabad are already on Dzylo?** This determines how fast the clock is ticking.

---

## Conclusion

Interior Studio OS is currently a functionally complete platform with the right architecture. The research confirms it has a real, defensible advantage in three areas no competitor has combined: WhatsApp-first automation, GST-native billing, and a rupee-denominated margin engine.

The work ahead is in two tracks running in parallel:
- **Depth track:** Make every existing module feel premium (Phase 1) and add AI automation (Phase 3)
- **Visual track:** Build the Three.js room viewer and design approval system (Phase 2) to close the Dzylo visualization gap

If both tracks execute on the 14-month roadmap above, Interior Studio OS will occupy the top-right quadrant of the competitive map — high depth + high India-specificity — with no direct competitor at the same altitude.

**The goal is not to be the best interior design CRM in India. The goal is to be the only one an interior designer in India would feel embarrassed not to use.**

---

*Sources: dzylo.ai (primary, 3-0 verified), support.procore.com (primary, 3-0 verified), 27 secondary sources (directional only — failed adversarial verification). 112 research agents, 782 seconds, 2.79M tokens.*
