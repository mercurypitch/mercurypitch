---
doc_id: tour-offers
title: Tour offers
area: onboarding
status: current
sources:
  - src/features/tours/**/*.ts
related:
  - src/stores/app-store.ts
  - src/components/Walkthrough.tsx
  - .claude/skills/tour-check/SKILL.md
anchor:
  content: sha256:0d12ac0780ad82a8
  api: sha256:6e21ce28b9a26a02
  files: 3
  reviewed: 2026-07-30
  commit: 6fa4769
---

# Tour offers

This feature decides *when to offer* a spotlight tour. It does not define the
tours. Step catalogs (`WALKTHROUGH_STEPS`, `PAGE_TOURS`, `PAGE_TOUR_CATALOG`) and
the spotlight renderer live in `src/stores/app-store.ts` and
`src/components/Walkthrough.tsx` — see CLAUDE.md for when a change there requires
the full `/tour-check` walk.

Three entry points, each for a different shape of tour.

## Per-page offers

`usePageTourOffer(activeTab)` offers a page's tour the first time the user lands
on a tab that has one. Behaviour worth knowing:

- The choice is remembered in `localStorage` under
  `pitchperfect_page_tour_offered_<tab>`, so it never nags twice.
- Every tab change first calls `removeNotificationsByChannel(TOUR_OFFER_CHANNEL)`,
  retiring the standing offer. A first-time user hopping across tabs gets one
  toast at a time instead of a stack.
- If `walkthroughActive()` is true, the offer is skipped but still marked as
  offered. A running tour is what navigated here (page tours move between tabs
  via `requiredTab`), so the user is already touring — a "take a quick tour"
  toast on top would be noise.

## One-shot contextual offers

`offerTourOnce(storageKey, message, steps)` is for tours whose targets only exist
inside a sub-view — the stem mixer, for example, which mounts only once a karaoke
session is loaded, so a tab-keyed offer would fire too early.

It writes the storage key immediately, before showing the toast, so a re-mount
cannot double-offer. If `localStorage` throws (private mode), it degrades to
offering once per session rather than failing.

Both offer paths share `TOUR_OFFER_CHANNEL`, which is a single-slot channel: a
contextual offer and a per-page offer can never stack.

## Guarded manual start

`startMixerTourIfReady()` is the manual entry (Guide modal, and the Karaoke
Learn-tutorial bridge). It checks that `[data-tour="mixer.stems"]` is in the DOM
before starting. The default Karaoke view is the upload screen, where the mixer
tour's targets do not exist and every step would render as a target-less centered
tooltip. When nothing is loaded it shows a notification telling the user to open a
song first.

## Gotchas

- The DOM probe in `startMixerTourIfReady` is a proxy for "the mixer is mounted".
  If `data-tour="mixer.stems"` is renamed, the guard silently inverts — the tour
  becomes permanently unreachable rather than erroring. Grep the selector when
  touching mixer markup.
- `offerTourOnce` marks as offered *before* the user answers, so a user who never
  sees the toast (it auto-dismissed while they were elsewhere) does not get a
  second chance. Manual re-start from the guide control is the recovery path.
