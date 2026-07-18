# Mobile Native v2 — app-wide mobile-first redesign

**Date**: 2026-07-18 · **Status**: planned (decisions locked with user)
**Why now**: Google Ads shows most users arrive on phones. Karaoke Night's
mobile stage proved the formula; this plan generalizes it to the core app —
starting with **Singing**, **Piano**, and **Exercises** — and prepares the
codebase for a Capacitor-packaged native app.

This replaces the archived squeeze-the-desktop approach
(`docs/archive/plans/mobile-ux-v1.md`). We no longer shrink desktop chrome
onto phones; each core surface gets a **purpose-built mobile stage** while
desktop keeps its full power. Mobile is the clean daily loop; desktop is the
studio users graduate to.

## Plan documents

| Doc | Contents |
| --- | --- |
| [mobile-kit.md](mobile-kit.md) | The modular mobile design system: tokens, primitives extracted from `KaraokeMobileStage`, conventions |
| [page-singing.md](page-singing.md) | Singing mobile stage spec |
| [page-piano.md](page-piano.md) | Piano (falling notes) mobile stage spec |
| [page-exercises.md](page-exercises.md) | Exercises alignment spec |
| [capacitor-readiness.md](capacitor-readiness.md) | Native-app preparation checklist + WKWebView spike |
| [native-feel-research.md](native-feel-research.md) | Research: what makes web apps feel native (sourced) |
| [mockups.html](mockups.html) | Phone-frame mockups of the redesigned screens |

## Decisions (2026-07-18, interview)

1. **Navigation — bottom tab bar + More sheet.** On `isNarrow()` viewports a
   fixed, glass, safe-area-aware bottom bar shows the first 4 visible
   practice-group tabs (from the existing `visibleTabOrder(scope, mode)` in
   `src/features/tabs/constants.ts` — scope/simple-mode gating keeps working
   for free) plus a **More** tab opening a sheet with the remaining tabs.
   Desktop keeps today's top tabs untouched. The top header on mobile shrinks
   to per-page essentials.
2. **Architecture — adaptive stages + shared kit.** Generalize the karaoke
   pattern: each core page renders a purpose-built `*MobileStage` behind
   `<Show when={!isNarrow()} fallback={…}>`, with engines/state owned above
   the branch (rotation/resize must never restart audio — proven in
   `StemMixer.tsx:353-356`). Primitives live in one shared kit
   (`src/components/mobile/`), extracted from `KaraokeMobileStage`, so every
   later surface (Guitar, Community, Settings…) is an assembly job, not a
   rebuild. Desktop DOM stays untouched → zero desktop regression risk.
3. **Capacitor — readiness now, early spike, wrap later.** All redesign work
   follows native-ready rules (safe areas, dvh, platform service layer,
   gesture-safe audio unlock). A throwaway Capacitor iOS spike runs early —
   before Phase 2 — to smoke-test mic + Web Audio + ONNX + IndexedDB inside
   WKWebView. Native projects get committed once the mobile shell stabilizes.
4. **Scope — core + one options sheet per page.** Each mobile stage keeps the
   core loop on screen (mic, transport, picker, live feedback, score) plus a
   single bottom **practice-options sheet** for the settings that matter
   mid-session (key/scale, play mode, BPM/speed, precount, metronome).
   Advanced tools (A-B loop, session sub-modes, anchor tone, display toggles,
   custom scale builder, history strip) stay desktop-only in v1 with a
   tasteful "More tools on desktop" hint — that hint is deliberate: it is the
   funnel from the ad-driven phone visit to the full desktop experience.

## Phases

Each phase is one or more `feat/*` PRs; every PR runs `pnpm check`, and PRs
that touch tour-targeted UI update the page tour in the same PR (CLAUDE.md
rule: tours cover ≥80% of user-visible features).

- **Phase 0 — Foundation (mobile kit).** `viewport-fit=cover` on all four
  HTML entries (today `env(safe-area-inset-*)` is 0 everywhere except
  karaoke.html — latent bug), safe-area/z-index/touch tokens, the extracted
  primitives (Sheet with drag-dismiss, BottomTabBar + More sheet, PillControl,
  Scrubber, StageShell, useScrollLock manager, haptics), `src/lib/platform/`
  service layer. Bottom bar ships here app-wide (it degrades gracefully on
  non-redesigned pages — it's just navigation).
- **Phase 1 — Singing mobile stage.** The flagship surface and the default
  tab. Includes extracting the inline `#practice-panel` JSX out of `App.tsx`
  into `src/features/practice/SingingPanel.tsx` (mechanical move, no visual
  change) so the `<Show>` swap has a seam.
- **Phase S — Capacitor spike (parallel with Phase 1).** Throwaway branch,
  results recorded in `capacitor-readiness.md`. Gate: nothing in the spike
  findings invalidates the stage architecture before Phase 2 starts.
- **Phase 2 — Piano mobile stage.** Reuses the kit + the Singing patterns
  (same transport/options-sheet skeleton, different canvas).
- **Phase 3 — Exercises alignment.** Already the most mobile-mature surface;
  align menu + `ExerciseShell` to kit tokens/primitives, adopt the options
  sheet, extend the mobile audit.
- **Phase 4 — App-wide expansion.** In priority order: in-app Karaoke tab
  adopts the zen stage on narrow (today `KaraokeMobileStage` only renders on
  the standalone entry — the in-app Karaoke tab still shows the desktop mixer
  on phones); Settings/Community/Leaderboard list-style cleanup; Compose and
  Analysis stay desktop-first with a friendly "built for desktop" card on
  narrow. PWA service worker + install prompt land here.
- **Phase 5 — Capacitor productionization.** Commit `ios/`/`android/`,
  plugins (haptics, status bar, keep-awake, splash), store assets, release
  workflow. Detailed in capacitor-readiness.md.

## Verification & tooling

- Extend the exercises pattern to every redesigned page:
  `scripts/audit-exercises-mobile.mjs` grows sibling audits (or a shared
  walker) asserting per-stage invariants — no horizontal overflow, transport
  visible, safe-area padding present, sticky CTAs reachable (see each page
  spec's "audit assertions").
- Tours: redesigned pages get updated `PAGE_TOURS` steps targeting the new
  mobile selectors in the same PR; full `/tour-check` stays a release gate.
- Playwright viewports: iPhone 13/15 Pro (390/393 px) as today, plus a
  360 px Android profile.

## Success criteria (product)

- Phone sessions complete the core loop (pick → sing/play → score) without
  ever needing a pinch-zoom, horizontal scroll, or mis-tap.
- Mobile retention/day-7 return improves on ad traffic (GA4 funnel:
  `mobile_stage_engaged`, `mobile_options_opened`, `desktop_hint_clicked`).
- Desktop upsell hint gets measurable clicks (the "come back on desktop"
  loop the redesign is designed to feed).
