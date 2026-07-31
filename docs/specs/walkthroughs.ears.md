# Walkthroughs — EARS Requirements

Requirements for the guided spotlight tours: how steps are presented,
navigated, completed, and re-run.

Source:

- `src/stores/app-store.ts` — `WALKTHROUGH_STEPS`, `PAGE_TOURS`,
  `PAGE_TOUR_CATALOG`, `GUIDE_SECTIONS`
- `src/stores/walkthrough-store.ts` — completion tracking
- `src/components/Walkthrough.tsx` — spotlight renderer
- `src/features/tours/` — per-page tour offers

Tests:

- `src/e2e/walkthrough.spec.ts` (`REQ-WALK-001..020`)
- `pnpm test:tours` (`scripts/walk-tours.mjs`) — full two-viewport walk,
  **release gate only**

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Presentation — `REQ-WALK-001..005`

### REQ-WALK-001 — Offered to new users
**WHEN** the app loads for a user who has not completed the introductory
walkthrough, the app **shall** offer it.

### REQ-WALK-002 — Spotlight on a real element
**WHILE** a step is active, the app **shall** highlight the element matched by
that step's `targetSelector`.

### REQ-WALK-003 — Selector must resolve
**IF** a step's `targetSelector` matches no visible element, **THEN** the tour
**shall** not present that step as spotlighted on empty space.

### REQ-WALK-004 — Sequential
Steps **shall** be presented in their declared order.

### REQ-WALK-005 — Progress is visible
**WHILE** a walkthrough is active, the app **shall** show the current step
position and the total, and mark already-visited steps.

## Navigation — `REQ-WALK-006..010`

### REQ-WALK-006 — Forward and back
The user **shall** be able to move to the next and previous step.

### REQ-WALK-007 — Skip a step
The user **shall** be able to skip the current step and advance.

### REQ-WALK-008 — Finish early
The user **shall** be able to complete a walkthrough before reaching its last
step.

### REQ-WALK-009 — Dismiss without completing
**WHEN** the user closes a walkthrough, the app **shall** dismiss it without
marking it complete.

### REQ-WALK-010 — Navigation across pages
**WHERE** a step declares a `navigate` target, the tour **shall** move to that
page before spotlighting.

## Completion — `REQ-WALK-011..014`

### REQ-WALK-011 — Explicit completion
**WHEN** the user activates the finish control, the app **shall** mark the
walkthrough complete.

### REQ-WALK-012 — Completion persists
Completion state **shall** persist across sessions.

### REQ-WALK-013 — Not re-offered
**WHILE** a walkthrough is marked complete, the app **shall** not offer it
unprompted again.

### REQ-WALK-014 — Count visible
The number of completed walkthroughs **shall** be visible to the user.

## Content — `REQ-WALK-015..018`

### REQ-WALK-015 — Title and description
Each step **shall** carry a title and a description stating what to do.

### REQ-WALK-016 — One feature per walkthrough
Each walkthrough **shall** target one coherent feature area.

### REQ-WALK-017 — Coverage
A page's tour **shall** cover at least 80% of that page's user-visible
features.

### REQ-WALK-018 — Kept in step with the UI
**WHEN** a feature is added to a page that has a tour, that tour **shall** be
updated in the same change.

## Re-running — `REQ-WALK-019..020`

### REQ-WALK-019 — Help entry point
The app **shall** provide a help affordance that opens the walkthrough
catalogue.

### REQ-WALK-020 — Replay
The user **shall** be able to re-run any walkthrough, including completed ones.

## Verification note

`REQ-WALK-003` is the requirement that breaks silently: selectors are strings,
so a renamed `data-tour` hook produces no type error. Per
[AGENTS.md](../../AGENTS.md), verify affected selectors per change; the full
walk runs only at release.
