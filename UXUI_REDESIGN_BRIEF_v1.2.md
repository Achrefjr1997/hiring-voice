# VoiceHire — UX/UI Redesign Brief
**From:** Tech Lead  
**To:** UX/UI Design Team  
**Date:** June 16, 2026  
**Version:** 1.2 — Pagination resolved as backend bug; recharts provenance clarified  
**Status:** Kickoff call no longer needed for Q1–Q4 — answers are resolved below

---

## 1. Executive Summary

VoiceHire is a multi-agent AI interview platform currently in MVP state. The product works — the backend architecture is solid. The problem is the frontend doesn't reflect the quality of what's underneath it. This brief gives you everything you need to redesign the UI/UX into something that feels like a serious enterprise SaaS product.

**One non-negotiable constraint:** The redesign must be **visually aligned with our pitch deck** (slides attached as reference). The pitch deck already defines our visual identity. Your job is to extend that identity into the full product UI — not invent something new.

---

## 2. Visual Identity from the Pitch Deck (CRITICAL — Read First)

Before designing a single screen, internalize the pitch deck's visual language. These are the rules that govern everything.

### 2.1 Color System

| Role | Value | Usage |
|---|---|---|
| **Primary Background** | `#0D0D0D` (near-black) | Main app background, sidebars, navbars |
| **Surface / Card** | `#1A1A1A` – `#222222` | Cards, panels, modals |
| **Border / Divider** | `#2A2A2A` – `#333333` | Subtle separators |
| **Primary Accent** | `#C9A84C` (warm gold) | Key CTAs, brand highlights, active states |
| **Secondary Accent** | `#E07040` (burnt orange/coral) | Secondary highlights, warnings, problem callouts |
| **Status: Live / Active** | `#4ADE80` (green) | Live interview badge, success states |
| **Status: Alert / Violation** | `#EF4444` (red) | Integrity violations, errors |
| **Status: Pending / Info** | `#60A5FA` (blue) | Info badges, system messages |
| **Primary Text** | `#F5F5F0` (off-white) | Body text on dark backgrounds |
| **Secondary Text** | `#888880` (muted warm gray) | Labels, captions, metadata |
| **Inverted Surface** | `#F5F0E8` (warm cream) | Candidate-facing light mode pages |
| **Inverted Text** | `#1A1A1A` | Body text on cream/light backgrounds |

> **Note on dark vs light:** The recruiter dashboard and admin views are dark-mode first (matching the pitch deck). Candidate-facing views use the warm cream/off-white background seen in slide 2 — this makes the candidate experience feel warmer and less intimidating.

### 2.2 Typography

| Scale | Weight | Size | Usage |
|---|---|---|---|
| **Display / Hero** | Bold | 48–64px | Landing, slide hero text |
| **H1** | Bold | 32–40px | Page/section titles |
| **H2** | Bold | 24–28px | Card headers, panel titles |
| **H3** | Semibold | 18–20px | Sub-section headers |
| **Body** | Regular | 14–16px | All content text |
| **Label / Caption** | Regular | 11–13px | Metadata, timestamps, badges |
| **Monospace** | Regular | 13px | Event logs, transcripts, code values |

**Font rules from the pitch deck:**
- Headlines use a **serif with personality** — the deck uses what looks like a Didot or Playfair Display variant. This is the brand voice: editorial, intelligent, premium.
- Body/UI uses a **clean sans-serif** (Inter or equivalent).
- **Never mix more than 2 typefaces** in a single view.
- The gold italic used for keywords (e.g., *v4*, *just said*) is a deliberate brand choice — use it sparingly for emphasis in marketing-adjacent views (onboarding, landing), not inside data-dense dashboards.

### 2.3 Spacing & Layout

- **Base unit:** 4px
- **Component padding:** 16px / 24px / 32px
- **Section spacing:** 48px – 64px
- **Card border-radius:** 8px (subtle, not pill)
- **Max content width:** 1280px centered

### 2.4 Deck-Derived Design Principles

These are extracted directly from reviewing the 3 pitch deck slides:

1. **Dark backgrounds with intentional contrast.** High contrast between background and content creates the "control room" feeling. Don't lighten things to be safe — lean into the dark.
2. **Typographic hierarchy does the heavy lifting.** The deck barely uses icons or illustrations. Big bold headlines carry meaning. UI should trust typography the same way.
3. **Gold = signal.** The gold accent (`#C9A84C`) appears only on things that matter. Don't use it decoratively — reserve for CTAs, active elements, and key data points.
4. **Cards with tight internal structure.** Slide 3's live interview mockup shows how content is organized inside a dark card: color-coded labels, monospaced values, clear event rows. This is the template for data-dense panels.
5. **Subtle horizontal rules / thin dividers** instead of heavy borders.
6. **Warm cream for candidate-facing views.** The off-black/cream contrast between recruiter and candidate interfaces is intentional — it signals a different mode.

---

## 3. User Roles & Their Views

| Role | Primary Views | Device |
|---|---|---|
| **Recruiter / HR** | Dashboard (History, Setup, Live) | Desktop only |
| **Hiring Manager** | Session Detail / Report View | Desktop |
| **Candidate** | Join → Live Interview → Thank You | Mobile + Desktop |

---

## 4. Problems to Solve (Prioritized)

### P1 — Recruiter Dashboard is a Scroll Pile
**Current state:** All panels (Coverage Map, Event Log, Evidence Portfolio, Integrity Violations) stacked vertically. When active, the screen is chaos.  
**Goal:** A control-room layout. Think mission control, not a log file. The recruiter should understand the full interview state in under 5 seconds without scrolling.  
**Direction:**
- Use a **grid layout**: primary panel (transcript / live feed) takes 60% width left, secondary panels (event log, coverage, violations) on the right in a 40% column
- Add **collapsible side panels** — the recruiter can hide sections they don't need
- Introduce **tab groups** for related sections (e.g., "Evidence" tab = Coverage Map + Evidence Portfolio combined)
- Use **status badges at the top** (a "status bar") showing: session time, candidate name, # competencies covered, # violations flagged

### P2 — Evidence Portfolio and Coverage Map Duplicate Data
**Current state:** Both panels show competency updates — the recruiter sees the same information twice.  
**Naming resolved:** "Coverage Map" is a testing-coverage metaphor, not a geographic map. Rename everywhere in the UI to **"Skill Map"** — this is clearer for recruiters and hiring managers who aren't engineers.  
**Goal:** Merge into a **unified Competency Panel** with two views:
- **Map View**: visual coverage grid (which competencies hit / unexplored / weak)
- **Evidence View**: list of evidence items with transcript anchor links
- Toggle between views with a tab or icon switch — default to Map View during live interview, Evidence View in report review

### P3 — Report View is a Wall of Text
**Current state:** 7 sections stacked in a modal, minimal hierarchy, cramped two-column deliberation layout.  
**Goal:** A professional document-style report. Reference: Stripe's invoice pages, Linear's issue detail view.  
**Direction:**
- **Sticky side navigation** showing section titles — click to jump
- **Collapsible sections** — expanded by default, can collapse to just the section header + summary score
- **Score visualization**: use a small horizontal bar or radar chart (recharts) for competency scores instead of raw numbers
- **Deliberation section**: horizontal split with Agent A on left, Agent B on right, verdict below — not vertical stacking
- **Evidence callouts**: inline transcript quotes in a styled blockquote component with a gold left border

### P4 — Candidate Has No Progress Indicators
**Current state:** Transcript + mic button. That's it.  
**Goal:** The candidate always knows where they are.  
**Direction:**
- **Progress bar** at the top: "Question 3 of 8 · 12:34 elapsed"
- **Stage label**: "Exploring: System Design" (current competency being probed)
- **Animated mic status**: pulsing ring when recording, flat when AI is speaking
- **AI speaking indicator**: subtle waveform animation or "VoiceHire is speaking..." label

### P5 — No Loading States
**Current state:** Plain text "Loading..." and "Verifying link..."  
**Goal:** Skeleton screens and smooth transitions everywhere.  
**Direction:**
- Skeleton loaders that match the shape of the loaded content (not generic spinners)
- Fade-in transitions on content load
- "Connecting to interview..." state with an animated orb (matching the pitch deck's microphone orb visual from slide 1)

---

## 5. Screen Inventory & Design Requirements

### 5.1 Login / Register
- Dark background (`#0D0D0D`)
- Centered card with VoiceHire wordmark at top
- Email + password fields, "Sign in" CTA in gold
- Minimal — no illustrations, no marketing copy
- Error states: red border + inline message under field

### 5.2 Recruiter Dashboard — History Tab
- Table/list of past sessions
- **Available columns from current API (`GET /sessions`):** Candidate name, Role, Date, Duration, Violation Count
- **⚠️ Backend-dependent columns — design as deferred/greyed-out placeholders for now:**
  - "Score" column — `GET /sessions` returns `violation_count` only, no aggregate score. Design the column slot but mark it `[Score — coming soon]` until the endpoint is updated.
  - Filter bar (date range, role, score threshold) — `GET /sessions` has no filter parameters. Design the filter UI but add a `[backend required]` annotation in your Figma handoff file.
- Row click → opens Report View modal
- Empty state: clean illustration + "No interviews yet. Start your first session."

### 5.3 Recruiter Dashboard — Setup Tab
- Form to configure an interview session: candidate name, email, role, competency profile
- Multi-step form preferred (Step 1: Candidate Info → Step 2: Interview Config → Step 3: Review & Send)
- Preview panel showing how the invite will look to the candidate
- Gold "Send Interview Link" CTA

### 5.4 Recruiter Dashboard — Live Interview Tab
**This is the most complex view. Design this first.**

```
┌─────────────────────────────────────────────────────┐
│ STATUS BAR: [● LIVE] Maya Chen · Sr. Backend Eng    │
│ 18:42 elapsed · 4/8 competencies · 0 violations     │
├─────────────────────┬───────────────────────────────┤
│                     │ [Tabs: Coverage | Evidence]   │
│  LIVE TRANSCRIPT    │                               │
│  (primary panel)    │  COMPETENCY PANEL             │
│  60% width          │  40% width                    │
│                     │                               │
│  Scrollable with    ├───────────────────────────────┤
│  auto-scroll toggle │  EVENT LOG                    │
│                     │  Collapsible                  │
│                     │                               │
│                     ├───────────────────────────────┤
│                     │  INTEGRITY MONITOR            │
│                     │  Collapsible                  │
└─────────────────────┴───────────────────────────────┘
```

- Event log items must be color-coded: gold = probe generated, blue = evidence extracted, green = target selected, red = violation
- Coverage grid: 3×N grid of competency pills — unexplored (dark), weak (amber), covered (green), must-have (gold border)
- Real-time updates must not cause jarring re-renders — use CSS transitions, not full re-mounts

### 5.5 Session Detail / Report View
- Opens as a full-screen modal overlay (not a separate page)
- Sticky sidebar navigation (left, 220px) with section anchors
- Sections: Summary → Competency Scores → Evidence → Deliberation → Integrity Report → Recommendation
- Score visualizations using recharts (radar chart for competency profile)
- "Export PDF" and "Share Link" actions in top-right
- Close button returns to dashboard without losing scroll position

### 5.6 Candidate — Join View
- Warm cream background (`#F5F0E8`)
- VoiceHire logo + "You're invited to interview for [Role] at [Company]"
- Tech check: microphone access, browser compatibility indicator
- "I'm ready — Begin Interview" CTA in dark button (inverted from recruiter gold)
- Mobile-first layout

### 5.6b Candidate — Waiting / Initializing View *(confirmed needed)*
This screen exists in the current code (`CandidateRoom.tsx` lines 63–76) as a 60-second polling loop while the competency graph generates. Currently it shows a dead "Joining…" button with no feedback. Design this screen properly:
- Same cream background as Join view
- Animated orb (reference slide 1) with a slow pulse — signals "AI is preparing"
- Message: "Getting your interview ready…" with a subtle progress indicator (indeterminate, not a countdown — the 60s is a max, not a guarantee)
- Do not show a spinner alone — this is a brand moment, not a loading screen
- If the wait exceeds ~45 seconds, surface: "This is taking a little longer than usual. Hang tight." — no action required from candidate

### 5.7 Candidate — Live Interview View
- Cream background, centered layout, max 600px wide
- Top: progress bar + stage label
- Center: animated AI avatar / orb (reference slide 1's microphone orb)
- Transcript: last 3 exchanges visible, scrollable history below
- Bottom: large mic button with recording state animation
- "Having technical issues?" link — small, unobtrusive

### 5.8 Candidate — Thank You / Ended View
- Simple, warm, human
- "Thank you, [Name]. Your interview is complete."
- Brief explainer: "Our team will review your interview and be in touch."
- No scores, no competency data — candidates never see raw scores

---

## 6. Component Library (Build These First)

Before designing full screens, establish these foundational components. Everything else is composed from them.

| Component | Variants |
|---|---|
| **Button** | Primary (gold), Secondary (outline), Ghost, Destructive, Icon-only, Loading state |
| **Badge / Tag** | Live (green), Pending (blue), Alert (red), Neutral (gray), Score (gold) |
| **Card** | Default, Interactive (hover state), Selected |
| **Input** | Default, Focus, Error, Disabled |
| **Select / Dropdown** | Default, Multi-select |
| **Modal** | Small (confirmation), Large (report), Full-screen |
| **Tab Group** | Horizontal tabs, Pill tabs |
| **Skeleton Loader** | Text line, Card, Avatar, Table row |
| **Status Bar** | Live session header strip |
| **Progress Bar** | Linear (candidate), Segmented (competency coverage) |
| **Event Log Item** | Probe, Evidence, Target, Violation — each with distinct left-border color |
| **Competency Pill** | Unexplored, Weak, Covered, Must-have |
| **Score Bar** | Horizontal bar 0–10 with color gradient |
| **Transcript Bubble** | AI turn, Candidate turn |
| **Blockquote / Evidence Card** | Gold left border, transcript excerpt + metadata |

---

## 7. Interaction & Motion Guidelines

- **Transitions:** 150ms ease-out for UI state changes, 300ms for modals and panels
- **Real-time updates:** New event log items slide in from bottom with a 200ms translate+fade — never a full re-render
- **Live badge:** Slow pulse animation (2s cycle) — never a fast blink
- **Mic recording:** Expanding concentric rings (like the orb in slide 1), gold color
- **AI speaking:** Gentle waveform or shimmer on the AI avatar
- **Skeleton loaders:** Use `opacity: 0.1 → 0.3` shimmer sweep, never a spinning loader for content areas
- **Collapsible panels:** Smooth height animation, chevron icon rotates 180°

---

## 8. Accessibility Requirements

- WCAG 2.1 AA compliance minimum
- All interactive elements keyboard navigable
- Focus rings visible on all focusable elements (use gold `#C9A84C` as focus ring color — it works on both dark and light backgrounds)
- Color is never the only signal — always pair color with text, icon, or pattern
- Minimum touch target size: 44×44px (critical for candidate mobile view)
- Screen reader labels on all icon-only buttons
- Live region (`aria-live`) on the event log and transcript for screen reader updates during live interviews

---

## 9. Technical Constraints (Do Not Design Around These)

| Constraint | Detail |
|---|---|
| **Framework** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 — utility-first, no custom CSS files |
| **Icons** | lucide-react only — do not spec any other icon library |
| **Charts** | recharts — confirmed in `package.json` but not yet used in any component. Its presence as a dependency is intentional — best current hypothesis is it was scoped for a chart feature that never got built. Either way, the radar chart in Section 5.5 (Report View competency scores) is the right place to debut it. Design team: keep chart specs achievable for a first recharts implementation — avoid highly customized layouts that require deep recharts internals to build. A clean `<RadarChart>` with labelled axes and the gold/green/red color palette from Section 2.1 is the target. |
| **Routing** | React Router v7 |
| **State** | React Context + custom hooks (no Redux, no Zustand) |
| **WebSocket** | Existing event payload structure is fixed — design must accommodate live data streams |
| **New API endpoints** | Cannot be added without backend work — design around existing data |

> **For the design team:** When speccing interactions that require data not currently in the API, flag it clearly in your handoff doc. Don't design features that require new backend endpoints without discussing with the tech lead first.

---

## 10. Deliverables & Timeline

### Phase 1 — Design Exploration (Week 1–2)
- [ ] User flow diagrams: recruiter journey + candidate journey
- [ ] Annotated wireframes for all 8 screens (low-fidelity, not pixel-perfect)
- [ ] Design token file: colors, typography scale, spacing, border-radius values
- [ ] Mood board confirming alignment with pitch deck visual identity

**Review gate:** Tech lead + product owner approve Phase 1 before Phase 2 starts.

### Phase 2 — High-Fidelity Mockups (Week 2–4)
- [ ] Pixel-perfect Figma frames for all 8 screens
- [ ] All component variants in a dedicated component page
- [ ] Dark mode frames (recruiter views) + light mode frames (candidate views)
- [ ] Mobile frames for candidate views (375px + 390px breakpoints)
- [ ] Interactive Figma prototype: recruiter flow + candidate flow clickable

**Review gate:** Full team review, iterate on feedback, lock designs.

### Phase 3 — Design System & Handoff (Week 5)
- [ ] Design tokens exported (JSON or Tokens Studio format)
- [ ] Component specs: states, variants, responsive rules
- [ ] Developer handoff notes in Figma (inspect-ready)
- [ ] Motion spec document: what animates, how, at what duration

---

## 11. Success Metrics (How We'll Know It Worked)

| Metric | Current | Target |
|---|---|---|
| Time for recruiter to understand session status | 30+ seconds scrolling | < 5 seconds at a glance |
| Candidate knows their progress | Never | Always |
| Report scannable | 2+ minutes | < 30 seconds |
| Next action is always obvious | Often unclear | Zero confusion |
| Subjective: feels like enterprise SaaS | No | Yes |

---

## 12. Reference & Inspiration

| Product | What to Study |
|---|---|
| **Linear** | Layout density, dark mode done right, motion quality |
| **Vercel Dashboard** | Status indicators, real-time data feel |
| **Stripe Dashboard** | Report/invoice design, data hierarchy |
| **Greenhouse / Lever** | Recruiter workflow UX, report structure |
| **Notion** | Sidebar navigation, collapsible sections |
| **Our own pitch deck** | The actual visual identity we're designing toward |

---

## 13. Pre-Kickoff Clarifications (Resolved)

The design team sent clarifying questions before kickoff. All answers are from the tech lead and should be treated as final decisions.

**Q1 — Multi-session support?**  
**Resolved: Single session only.** The current architecture (`useBandSession()` hook + `event_listener.py`) is built for one session at a time. Supporting multiple simultaneous sessions requires significant backend refactoring — deferred to a future milestone. Design only for single-session. Do not design a session-switcher, multi-session sidebar, or any UI implying parallel interviews.

**Q2 — "Integrity Violations" panel with zero violations?**  
**Resolved: Show as collapsed with a clean zero-state.** Don't hide the panel entirely — the recruiter needs to know monitoring is active even when clean. Default to collapsed when count = 0, with a label: "No violations detected." Expanded state (when violations exist) shows the full list. This is a trust signal, not just a data panel.

**Q3 — "Coverage Map" — geographic or metaphor?**  
**Resolved: Rename to "Skill Map" across all UI.** It's a testing-coverage metaphor (borrowed from software engineering), not a geographic map. "Skill Map" is immediately legible to recruiters and hiring managers. Update all labels, tab names, and component names in your designs to use "Skill Map." Never use "Coverage Map" in any user-facing text.

**Q4 — Candidate waiting screen?**  
**Resolved: Yes, this screen is needed and currently broken.** There is a confirmed 60-second polling loop in `CandidateRoom.tsx` (lines 63–76) while the AI generates the competency graph. The current state is a frozen "Joining…" button — no animation, no feedback. See Section 5.6b for the full design spec.

**Q5 — Backend-dependent features?**  
**Resolved: Design them visually but annotate as deferred.** The following features imply API endpoints that don't exist yet. Design them in Figma so they're ready when the backend catches up, but mark each with a `[⚙ Backend required]` annotation in your handoff:
- History tab filter bar (date, role, score) — `GET /sessions` has no filter params
- "Share Link" on report view — no endpoint exists
- Score column in session history — only `violation_count` is returned, no aggregate score

Do not remove these from the designs. Do not build workarounds that fake the data. Just design the UI and flag it.

**Q6 — Tailwind v4 dark mode behind Docker/Nginx?**  
**Tech lead note (for developer reference, not a design concern):** Tailwind v4 dark mode variant needs to be configured correctly in the Vite build — this is a dev environment concern, not a design constraint. Design team: use `#0D0D0D` as the recruiter background color and specify it explicitly in your design tokens. Don't rely on `dark:` class inference — the dev team will handle that.

---

## 14. Remaining Open Questions

These were NOT answered by the pre-kickoff clarifications. Raise in first review call.

1. **White-label requirements?** Does any client need a custom logo or color override? If yes, the design system needs a theming layer from day one.
2. **Report export format?** "Export PDF" is in scope but the rendering approach (print CSS, server-side PDF, or a third-party service) affects what the design can promise. Confirm before designing the export button flow.
3. **Session history pagination — flagged as a backend bug, not a design decision.** `GET /sessions` returns all sessions with no pagination. At 500+ rows this is already broken regardless of UI. Recommendation: resolve on the backend before redesign ships — even `?limit=50&offset=N` is sufficient. Design team: spec the history table with a standard paginator (Previous / Next + page indicator). Do not design infinite scroll — that requires a cursor-based API that doesn't exist. Mark with `[⚙ Backend required — GET /sessions needs limit/offset params]` in your Figma handoff.

---

## 15. Attachments

- `pitch-deck-slides.png` — 3 reference slides for visual identity extraction
- `uxui-brief-original.pdf` — Full original brief from product owner

---

*Prepared by Tech Lead · VoiceHire · June 2026*  
*v1.0 — Initial brief*  
*v1.1 — Incorporated pre-kickoff clarifications from design team: resolved Coverage Map naming, multi-session scope, candidate waiting screen, backend-dependent features, recharts status.*  
*v1.2 — Pagination resolved as a backend bug (not a design decision); history table spec updated to standard paginator, not infinite scroll. Recharts "first usage" clarified: intentional dependency, radar chart in Section 5.5 is the planned debut.*
