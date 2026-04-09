# Halvex V2 — Product Overhaul Spec

**Author:** Product
**Date:** 2026-03-25
**Status:** Draft for review

---

## 1. Problem Statement

Halvex has strong backend intelligence (workspace brain, ML scoring, deal-to-issue loops, Slack agent) but the frontend doesn't surface it. The product feels like a CRM with AI bolted on, when it should feel like a **deal intelligence platform that happens to have CRM**.

### What's wrong today:
- **Onboarding** creates no "aha moment" — user connects things, adds a deal, gets a checklist. No intelligence fires.
- **Today page** is a wall of equal-weight cards. No clear "here's what you should do right now."
- **Deals page** has 3 views (Intelligence/Kanban/ML) but none center the narrative on "this deal is at risk because X, and here's what to do."
- **Data propagation** is incomplete — `rees@halvex.ai` sees empty states, stale data, missing scores.
- **UI** is glassmorphic in globals.css but most components use ad-hoc inline styles. The glass effect is inconsistent. It looks like a SaaS startup, not an enterprise intelligence tool.
- **Loops** exist as a concept but the connection between "deal risk → Linear issue → resolution → deal unblocked" isn't visible end-to-end.
- **Slack bot** is capable but doesn't proactively fire after onboarding. User has to discover it.

### Core thesis:
> Halvex is a deal intelligence platform. Intelligence powers everything: which deals are at risk, why, what product work would unblock them, what sales actions to take today. The CRM is the data layer that feeds the intelligence — not the other way around.

---

## 2. Design Principles

1. **Intelligence-first, not data-first.** Every screen answers "what should I do?" before "what data do I have?"
2. **Proactive, not reactive.** The system tells you what's wrong before you ask. The Slack bot DMs you. The Today page surfaces urgency.
3. **Enterprise density, not SaaS playfulness.** Think Bloomberg Terminal meets Linear. Dense, information-rich, monochrome with accent color for urgency. No empty illustrations. No confetti.
4. **One brain, multiple surfaces.** The workspace brain is the single source of truth. Today page, Deals page, Slack bot, and email digest are all views into the same intelligence.
5. **The loop is the product.** Deal risk → Issue discovery → PM scoping → Ship → Deal unblocked. Every screen should show where you are in this loop.

---

## 3. Visual Design Overhaul

### 3.1 Color & Surface System

**Keep:** Dark glassmorphism as foundation. This is correct for enterprise intelligence tools.

**Fix:**
- Standardize glass layers: exactly 3 tiers (bg, card, elevated)
- Remove inconsistent rgba values — use CSS variables everywhere, no inline overrides
- Tighten the color palette:
  - **Background:** Deep navy gradient (keep current 135° purple→blue)
  - **Card surface:** `rgba(255,255,255,0.04)` with `blur(20px)` — subtler than current
  - **Elevated surface:** `rgba(255,255,255,0.08)` with `blur(24px)` — modals, popovers
  - **Accent:** Single indigo `#6366f1` — no more dual purple/indigo confusion
  - **Urgency:** Red `#ef4444` for at-risk, Amber `#f59e0b` for attention, Green `#10b981` for on-track
  - **Text:** 4 tiers only: primary (92%), secondary (60%), tertiary (40%), muted (25%)

### 3.2 Typography

**Simplify to 2 fonts:**
- **Inter** for all UI text (loaded, proven, enterprise)
- **SF Mono / Geist Mono** for numbers, scores, metrics only
- Remove Playfair Display, Poppins — they add personality we don't want

**Scale:** Use rem, not px. Base 13px is fine but express as rem for scaling.

### 3.3 Component Consistency

- Every card: same border radius (8px), same border color, same blur
- Every button: same height (32px compact / 36px default / 40px large), same font weight (500)
- Every input: same glass treatment, same focus ring
- No inline style overrides for glass properties — all via CSS class

### 3.4 Information Density

- Reduce whitespace. Enterprise users want density.
- Use tables and lists, not cards, for data > 5 items
- Score indicators: compact pill with number + dot color, not large circular gauges
- Status badges: small, monochrome with colored dot prefix

---

## 4. Onboarding Overhaul

### Current: 4 steps, no intelligence fires, checklist completion
### New: 3 steps + automatic "aha moment"

```
Step 1: Connect Slack
  → OAuth flow
  → On success: Bot immediately sends DM in user's workspace:
    "Hey! I'm Halvex. I'll be your deal intelligence copilot.
     Once you connect Linear and add your first deal, I'll start
     finding issues that could help you close faster. Finish setup: [link]"
  → UI shows: "Connected to [workspace name]" with green check
  → Auto-advance to step 2

Step 2: Connect Linear
  → OAuth flow
  → On success: Background sync fires immediately
  → UI shows: "Syncing issues..." → "Synced 47 issues from [team name]" with count
  → Auto-advance to step 3

Step 3: Add your first deal
  → Minimal form: Company name, Deal value, Stage, "What's blocking this deal?"
  → The "what's blocking" field is critical — this feeds the gap analysis
  → On submit:
    1. Deal created
    2. Brain rebuild triggers
    3. Gap analysis runs against synced Linear issues
    4. Score computed
    5. Matching issues found
  → UI shows: Loading state → Results:
    "Found 3 issues that could help close [Company]:
     - [Issue title] — matches blocker: [extracted objection]
     - [Issue title] — matches blocker: [extracted objection]
     - [Issue title] — related to competitor gap
     Want me to prioritize these? [Yes, scope them] [I'll review later]"
  → Simultaneously, Slack bot sends DM:
    "I just analyzed your deal with [Company]. Found 2 issues in Linear
     that could help close this — want me to prioritize them?
     • LIN-142: SSO support → matches their security requirement
     • LIN-89: Bulk import API → matches their migration concern
     Reply 'yes' to scope these into the next cycle."

Step 4: Done → Redirect to Today page
  → Today page shows the deal with its score, risks, and linked issues
  → The loop is visibly active from minute one
```

### Key differences from current:
1. **Bot fires immediately** on Slack connect — user sees life in their workspace
2. **Issue count shown** on Linear connect — proof that sync worked
3. **Gap analysis is the aha moment** — "we found issues that match your deal blockers" is the value prop in action
4. **Slack bot mirrors the aha** — user sees intelligence in two places simultaneously
5. **No "done" checklist screen** — redirect straight to the live product

---

## 5. Today Page Redesign

### Current: Wall of cards (stats, AI overview, urgent, stale, this week, loops, activity)
### New: Single-column command center with clear hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ TODAY — March 25, 2026                    Brain: Live ●  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚡ DO NOW (highest priority actions)                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔴 Acme Corp — $120k — Closing in 3 days            │ │
│ │    Score: 42 (dropped 15pts)                        │ │
│ │    Risk: No champion identified, competitor active   │ │
│ │    → Send case study: "Enterprise migration at X"   │ │
│ │    → 2 Linear issues could unblock (LIN-42, LIN-89)│ │
│ │    [View deal] [Ask bot to scope issues]            │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ 🟡 TechStart — $85k — PM needs to approve scope    │ │
│ │    Loop: LIN-142 (SSO support) awaiting PM          │ │
│ │    → Nudge PM in Slack or confirm yourself          │ │
│ │    [Approve scope] [Ask in Slack]                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 PIPELINE HEALTH                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 12 deals │ $1.2M pipeline │ 67 avg score │ $340k    │ │
│ │                                          forecast   │ │
│ │ ● 3 at risk  ● 5 on track  ● 2 stale  ● 2 won     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🔄 ACTIVE LOOPS                                        │
│ ┌──────────────────┬──────────┬──────────┬───────────┐ │
│ │ Deal             │ Issue    │ Status   │ Days      │ │
│ ├──────────────────┼──────────┼──────────┼───────────┤ │
│ │ Acme Corp        │ LIN-42   │ In cycle │ 4d        │ │
│ │ Acme Corp        │ LIN-89   │ Awaiting │ 2d ⚠️     │ │
│ │ TechStart        │ LIN-142  │ Awaiting │ 6d 🔴     │ │
│ │ BigCo            │ LIN-201  │ Shipped  │ ✓         │ │
│ └──────────────────┴──────────┴──────────┴───────────┘ │
│                                                         │
│ 💡 INTELLIGENCE                                        │
│ "3 of your deals mention SSO as a blocker. LIN-142     │
│  would unblock $305k in pipeline. Consider prioritizing │
│  for next cycle."                                       │
│                                                         │
│ "Competitor X appeared in 2 new deals this week.        │
│  Win rate against X: 60% (3/5). Key differentiator:     │
│  deployment speed."                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key differences:
1. **"Do Now" section is the entire top half** — not buried among other cards
2. **Each action item tells you WHY and WHAT TO DO** — not just "deal X is at risk"
3. **Loops shown as a table, not cards** — dense, scannable
4. **Intelligence section** gives cross-deal insights — "3 deals mention SSO" is actionable
5. **Pipeline health is a single compact row** — not a section of big number cards
6. **No AI Overview card** — the entire page IS the AI overview

---

## 6. Deals Page Redesign

### Current: 3 tabs (Intelligence/Kanban/ML) — confusing, ML view is internal
### New: 2 views — Intelligence (default) and Pipeline (kanban)

### Intelligence View (default):
Every deal shown as a dense row with inline intelligence:

```
┌─────────────────────────────────────────────────────────────────┐
│ DEALS                              [+ Add deal]  [Pipeline ▾]  │
├─────────────────────────────────────────────────────────────────┤
│ Filter: All ● At Risk ● Closing Soon ● Stale ● Won ● Lost     │
├────────┬─────────┬───────┬────────┬──────────┬─────────────────┤
│ Deal   │ Value   │ Score │ Stage  │ Loops    │ Top Risk        │
├────────┼─────────┼───────┼────────┼──────────┼─────────────────┤
│ 🔴 Acme│ $120k   │ 42 ↓  │ Nego   │ 2 active │ No champion     │
│ 🟡 Tech│ $85k    │ 61    │ Demo   │ 1 await  │ Competitor: X   │
│ 🟢 BigC│ $200k   │ 78    │ Eval   │ 1 shipped│ —               │
│ ⚪ NewC│ $50k    │ —     │ Disco  │ 0        │ Budget unclear  │
└────────┴─────────┴───────┴────────┴──────────┴─────────────────┘
```

- Click a row → deal detail page (keep existing, but clean up)
- Score arrows show trend (↑↓)
- Loops column shows count + worst status
- Top Risk extracted from brain urgency analysis
- **Remove ML tab entirely** — ML powers the score, it shouldn't be a user-facing view

### Pipeline View (kanban):
Keep existing kanban but:
- Each card shows: Company, Value, Score dot, Days in stage
- Drag to reorder within column (keep)
- Drag across columns = stage change (keep)
- Remove extra metadata from cards — keep them scannable

---

## 7. Intelligence Page Redesign

### Current: Win/loss stats + patterns + gaps + KB editor — unfocused
### New: Three sub-pages under Intelligence nav

**7.1 Intelligence → Overview (default)**
- Win rate, avg close time, revenue forecast
- Top patterns across pipeline (deduplicated from brain)
- Competitor leaderboard (win rate per competitor)
- Product gaps ranked by revenue impact

**7.2 Intelligence → Playbook**
- Objection → winning response mapping (from won deals)
- Stage-specific guidance (what works at each stage)
- Competitor battlecards (auto-generated from brain)
- Case study recommendations per objection type

**7.3 Intelligence → Models** (admin/power user)
- ML model health, feature importance
- Calibration timeline
- Deal archetypes
- This is the current ML tab, moved here where power users can find it

---

## 8. Loops Page — Keep, Refine

The Loops page concept is correct. Refine:
- Default sort: urgency (revenue at risk × days awaiting)
- Add "Approve" action directly from the table (don't require navigating to deal)
- Show the deal objection that this issue addresses inline
- Add "Nudge PM" button that fires Slack message

---

## 9. Slack Bot — Proactive Intelligence

### Current: Responds to messages, no proactive behavior
### New: Proactive + Reactive

**Proactive triggers (new):**
1. **Post-onboarding:** Immediately after first deal gap analysis, send results as DM
2. **Daily brief:** Morning DM with today's urgent actions (reuse Today page logic)
3. **Score drop alert:** When a deal's score drops >10pts, DM the assigned rep
4. **Loop status change:** When an issue moves to "done" in Linear, DM: "LIN-142 shipped! This unblocks [deal] — time to follow up with [prospect]"
5. **Stale deal nudge:** After 7 days no activity, gentle DM: "[Deal] hasn't been updated in 7 days. Still active?"

**Reactive (keep + improve):**
- All existing tools (deal lookup, issue discovery, scoping)
- Add: "What should I do today?" → surfaces Today page intelligence
- Add: "Run gap analysis on [deal]" → triggers fresh issue matching

---

## 10. Data Propagation Fixes

### Problem: rees@halvex.ai sees empty states everywhere

**Root causes to fix:**
1. Brain rebuild only fires on deal CRUD — should also fire on integration connect, issue sync, and manual trigger
2. Score computation requires meeting notes or explicit signals — new deals start with no score. Should compute initial score from stage + value + deal age
3. Loop discovery only runs when deal notes change — should also run on initial deal creation if Linear is connected
4. Dashboard API endpoints return empty arrays when brain hasn't been built — should return "building..." state, not empty
5. Intelligence page shows "no data" when there are < 3 closed deals — should show whatever it can, even with 1 deal

**Specific fixes:**
- `POST /api/deals` → after creation, trigger brain rebuild AND loop discovery (if Linear connected)
- `GET /api/brain` → if brain is null, trigger rebuild and return `{ status: 'building' }`
- `GET /api/dashboard/summary` → compute from raw deals if brain is stale, don't depend on brain
- Score: default to stage-based heuristic when no signals exist (Discovery=20, Demo=40, Eval=55, Negotiation=70, etc.)
- Today page: show "Core loop is active" banner when integrations are connected + deals exist, even if brain is still building

---

## 11. Technical Architecture Notes

### What NOT to change:
- Database schema (mature, well-designed)
- Workspace brain concept (correct abstraction)
- Slack agent tool system (works well)
- ML scoring pipeline (real IP)
- API route structure (comprehensive)

### What to change:
- **Frontend only** — new pages, new components, new styling
- **API response handling** — graceful degradation when brain is building
- **Trigger chain** — ensure every mutation fires the right downstream effects
- **Proactive Slack messages** — new endpoints for bot-initiated DMs

### Migration path:
1. Fix data propagation (backend, ~2 days)
2. Standardize design system (CSS variables + component library, ~2 days)
3. Rebuild onboarding (3-step + aha moment, ~2 days)
4. Rebuild Today page (command center, ~2 days)
5. Refactor Deals page (remove ML tab, add intelligence columns, ~1 day)
6. Refactor Intelligence page (3 sub-pages, ~2 days)
7. Add proactive Slack triggers (~2 days)
8. Polish and test (~2 days)

---

## 12. Success Criteria

1. **New user connects Slack + Linear + adds 1 deal → receives Slack DM with matching issues within 60 seconds**
2. **Today page loads with actionable intelligence on first visit after onboarding**
3. **Every deal has a score** (even new ones, using stage heuristic)
4. **Zero empty states** when integrations are connected and 1+ deal exists
5. **Glass styling is consistent** — same blur, same borders, same colors on every surface
6. **The product feels like a Bloomberg Terminal for deals** — dense, intelligent, proactive

---

## 13. What This Spec Does NOT Cover (Explicitly Out of Scope)

- Mobile app
- Salesforce integration
- Pricing/billing changes
- New database tables
- New ML models
- HubSpot improvements
- Public API / MCP changes
- Multi-workspace features

---

## 14. Open Questions

1. **Should we keep HubSpot in onboarding?** Currently it's a separate integration. Spec assumes Slack + Linear are the core onboarding path.
2. **Should Intelligence sub-pages be separate routes or tabs?** Routes are more bookmarkable but tabs feel faster.
3. **Should proactive Slack DMs be opt-in per user?** The `slack_user_mappings` table already has notification prefs — we should respect them.
4. **Daily brief timing** — morning in whose timezone? User's local time from Clerk profile?

---

*This spec is a complete overhaul of the frontend and trigger chain while preserving the backend intelligence that is Halvex's real IP. The goal: make the intelligence visible, make the loop tangible, make the aha moment immediate.*
