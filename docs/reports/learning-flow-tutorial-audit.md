# Learning-Flow & Tutorial Audit

_Branch: `feat/learning-flow-tutorial-review-7y5sjf`_

A full pass over the "learn about the app" user story — the **Learn** sidebar
button (read-along chapters), the **Guide** sidebar button (interactive
spotlight tours), the per-page **Tour** offers, and the Settings **Danger
Zone**. Goal: every tour target is correct after the recent relayouts, the
animations/page-shifting behave, notifications don't stack, and the data-reset
controls actually do what they say.

## TL;DR — what was broken and fixed

| # | Area | Problem | Fix |
|---|------|---------|-----|
| 1 | Singing tour | Step "Play / Pause / Stop" pointed at `[data-tour="transport.essential"]`, which **did not exist** on any element. The highlight failed and the tooltip floated centred. | Added `data-tour="transport.essential"` to the transport control group in `SingingControlBar.tsx`. |
| 2 | Settings tour (relayout regression) | Settings was split into **General / Practice / Display** sub-tabs. Five guide steps target controls that now live under a non-default sub-tab, but the tour only switched to the Settings *tab* (which opens on **General**), so the targets weren't in the DOM. | Added `navigate[]` to each affected step so the tour clicks the correct sub-tab first (mirrors how the Guitar/Analysis tours reveal sub-views). |
| 3 | Per-page tour offers | A first-time user hopping across tabs **stacked** a separate "take a quick tour" toast per page. | Added a notification *channel* so all tour-offer toasts share one slot — a new one replaces the old, and leaving a tab retires the standing offer. Only the latest is ever shown. |
| 4 | Danger Zone — factory reset | "Reset to Factory Defaults" only removed `pitchperfect_*` localStorage keys, leaving `sidebar-*`, `km-*`, `mp:*` (identity/auth), and `pitch_test_mode` behind — so it wasn't truly a factory reset. | Now clears **all** localStorage + sessionStorage (plus the model cache and IndexedDB, as before). |
| 5 | Danger Zone — UVR/karaoke | `deleteAllUvrSessions()` orphaned stem blobs, fingerprints, and whisper transcriptions in IndexedDB; there was no way to clear *only* karaoke data. | `deleteAllUvrSessions()` now also wipes stems, fingerprints and transcriptions; added a dedicated **"Clear Karaoke & Vocal Separation Data"** button that removes sessions + stems + lyrics + fingerprints + transcriptions + groups + playlists while keeping melodies/history/settings. |

## How the learning flow is wired (reference)

- **Learn** (`AppSidebar` → `onOpenLearn` → `openLearningWalkthrough`):
  opens `WalkthroughSelection` → `WalkthroughModal`. These are **read-along
  chapters** (markdown + a "How to use" step list). The chapters' `step.target`
  fields are descriptive only — they are **not** used to highlight the DOM, so
  they can't "break" a tour. Each chapter offers a **"Take the interactive
  tour"** bridge into the matching spotlight tour.
- **Guide** (`AppSidebar` → `onOpenGuide` → `openGuideSelection`): opens
  `GuideSelection`, which launches the **spotlight tours** — App-basics section
  tours (`WALKTHROUGH_STEPS`), per-page tours (`PAGE_TOURS`), and the contextual
  karaoke mixer tour.
- **Tour** (sidebar, shown only when `hasPageTour(activeTab)`): launches the
  current page's spotlight tour directly.
- **Per-page offer** (`usePageTourOffer`): the one-time "New to X? Take a quick
  tour." toast, shown the first time a tab with a page tour is visited.
- The spotlight engine (`Walkthrough.tsx`) handles page-shifting: it switches to
  a step's `requiredTab`, opens the mobile sidebar for `inSidebar` steps, clicks
  through `navigate[]` selectors to reveal nested UI, then scrolls + highlights.

## Tour target audit

Every `targetSelector` and `navigate` selector across all spotlight-tour arrays
in `app-store.ts` (`WALKTHROUGH_STEPS`, `PRACTICE_MODES_TOUR_STEPS`,
`GUITAR/PIANO/ANALYSIS/EXERCISES/JAM/COMMUNITY/LEADERBOARD/CHALLENGES_TOUR_STEPS`,
`STEM_MIXER_TOUR_STEPS`) was cross-checked against the rendered DOM hooks.

**Result: 65 unique selectors — all now resolve.** Before this change, two were
broken (see #1 and #2 above). The remaining 63 were verified present, including
the ones already using the reveal-then-highlight pattern (`guitar.view-fretboard`,
`aria-label="Vocal Analysis|Pitch Detection|Pitch Algorithms"`).

### Feature coverage (every tab is reachable from the learning flow)

| Tab | Learn chapter(s) | Spotlight tour |
|-----|------------------|----------------|
| Singing | Practice Toolbar, Practice Modes | App-basics: Singing + Toolbar sections; Practice-Modes bridge tour |
| Compose | Compose Toolbar, MIDI, Advanced | App-basics: Compose + Effects sections |
| Settings | Overview, ADSR, Reverb | App-basics: Settings section |
| Study (Learn-only) | Pitch, Scales, Progress, Pro Tips | — (concept chapters) |
| Guitar | Guitar Practice & Fretboard | Page tour |
| Piano | Falling-Notes Piano | Page tour |
| Karaoke | Stem Mixer | Contextual mixer tour (offered on load + Guide entry) |
| Exercises | Singing Exercises | Page tour |
| Analysis | Vocal Analysis & Pitch Tools | Page tour |
| Jam | Real-time Jam Rooms | Page tour |
| Community | Share & Community Feed | Page tour |
| Leaderboard | Leaderboards & Ranking | Page tour |
| Challenges | Vocal Challenges & Badges | Page tour |

## Notification stacking fix (detail)

`notifications-store` gained an optional `channel` on a notification. Pushing a
notification with a channel first evicts any other notification on that channel,
so a whole category of toast can only ever show one at a time. The shared
`TOUR_OFFER_CHANNEL` is used by both `usePageTourOffer` (per-page offers) and
`offerTourOnce` (the contextual stem-mixer offer). `usePageTourOffer` also
retires the standing offer on every tab change, so switching tabs as a
first-timer surfaces only the current page's offer instead of a pile.

## Danger Zone (detail)

### Factory reset — now a true wipe

`handleResetStorage()` previously removed only `pitchperfect_*` keys. It now
calls `localStorage.clear()` + `sessionStorage.clear()` before clearing the
model cache and destroying/recreating IndexedDB, then reloads. This also clears
the anonymous identity (`mp:userId`) and auth token (`mp:authToken`) — i.e. a
real factory state (you return as a fresh anonymous user; cloud data, if any,
is still on the server and reappears on re-login).

### New: Clear Karaoke & Vocal Separation Data

A second danger-zone button removes **only** karaoke/UVR data, leaving
melodies, practice history, and settings untouched. It clears, across the
in-memory caches and IndexedDB:

- `uvrSessions` + their `uvrStemBlobs`, `uvrStemFingerprints`,
  `uvrSessionLyrics`, and `whisperTranscriptions`
- `sessionGroups` (the folders that organise sessions)
- `karaokePlaylists` (saved set lists)

UVR *preferences* (processing mode, intensities, denoise) are intentionally
kept — they're settings, not session data.

### Orphan bug fixed for the existing "clear all sessions" too

`deleteAllUvrSessions()` used to delete only the session records + lyrics,
leaving stem audio blobs, fingerprints, and whisper transcriptions orphaned in
IndexedDB. It now routes through `deleteAllUvrSessionsFromDb()` and also clears
transcriptions, so the existing in-app "clear storage" action no longer leaks
rows either.

## Mobile pass

A second pass focused on phones/narrow viewports.

- **"Choose your character!" failed on mobile.** The step targets
  `#character-icons`, which renders only inside the off-canvas sidebar, but it
  lacked `inSidebar: true` — so on mobile the drawer never opened and the
  spotlight pointed at an off-screen element. Added `inSidebar: true` (matching
  the Scale & Key / Load Melody / Editor Toolbar steps).
- **Toolbar steps could highlight an off-screen control.** The shared control
  bar (`control-bar.module.css .bar`) is `overflow-x: auto` and scrolls
  horizontally on narrow screens, but the tour's `scrollToTargetIfNeeded()`
  only checked **vertical** bounds — so BPM / Volume / Play-mode steps (and the
  Compose Record button) could sit scrolled off to the side and never be
  reeled in. The helper now also detects horizontal clipping and uses
  `scrollIntoView({ inline: 'center' })`, which scrolls the right scroll
  ancestor into view. Benefits narrow desktop too.
- **Tooltip action row on the smallest screens.** Added `flex-wrap` to the
  spotlight tooltip's action row at `≤360px` so the four controls (Skip Tour /
  Back / Skip Section / Next) wrap instead of overflowing.

The four learning-flow overlays (`Walkthrough`, `GuideSelection`,
`WalkthroughSelection`, `WalkthroughModal`) were reviewed and are already
mobile-responsive (`max-width`/`vw` constraints, `max-height` + scroll, and
`≤480/≤360px` breakpoints). On mobile, Learn/Guide/Tour are reached via the
header hamburger → sidebar drawer (standard pattern); the drawer auto-opens for
sidebar-anchored tour steps and closes again afterward.

## Files changed

- `src/components/singing/SingingControlBar.tsx` — add `transport.essential` hook.
- `src/stores/app-store.ts` — `navigate[]` on Settings tour steps; `inSidebar`
  on the character step; thorough `deleteAllUvrSessions()`; new
  `deleteAllSessionGroups()`.
- `src/components/Walkthrough.tsx` — scroll horizontally-clipped targets into
  view (`scrollToTargetIfNeeded`).
- `src/components/Walkthrough.module.css` — wrap tooltip actions at `≤360px`.
- `src/stores/notifications-store.ts` — notification `channel` support +
  `removeNotificationsByChannel` + `TOUR_OFFER_CHANNEL`.
- `src/features/tours/usePageTourOffer.ts`, `src/features/tours/offerTourOnce.ts`
  — single tour-offer slot.
- `src/stores/karaoke-playlist-store.ts` — `deleteAllPlaylists()`.
- `src/db/services/whisper-transcription-db-service.ts` —
  `deleteAllTranscriptionsFromDb()`.
- `src/components/SettingsPanel.tsx` — true factory reset + "Clear Karaoke &
  Vocal Separation Data" button and confirm dialog.

## Verification

- `pnpm check` — typecheck + lint + format clean (one pre-existing unrelated
  `solid/reactivity` warning in `ControlOverlay.tsx`).
- `pnpm test:run` — 121 files, 2176 tests pass.
