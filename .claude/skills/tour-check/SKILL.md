---
name: tour-check
description: Verify the guided spotlight tours end-to-end by walking every tour step in a real browser (scripts/walk-tours.mjs) and asserting each step spotlights a visible element. Use after ANY change to tour steps or the UI they target — Walkthrough.tsx, WALKTHROUGH_STEPS / PAGE_TOURS in src/stores/app-store.ts, data-tour hooks, control bars, sidebar, or the settings panel — and before releases (e.g. "/tour-check", "verify the tours", "are the tours still working?").
---

# /tour-check — walk every guided tour and verify the spotlights

The app's onboarding is a set of spotlight tours (see the architecture notes
below). Selectors rot silently when UI is refactored, so the only trustworthy
check is walking every tour step in a real browser. `scripts/walk-tours.mjs`
does exactly that and exits non-zero if any step's spotlight misses.

## Steps

1. **Build and serve** a production bundle (any static server works):
   ```sh
   pnpm run build
   pnpm dlx serve dist -l 3005 &
   ```
   To also exercise the "backend unreachable" path, build with
   `VITE_API_BASE_URL=http://127.0.0.1:59999 pnpm run build`.

2. **Walk all tours** on both viewports:
   ```sh
   pnpm run test:tours              # desktop 1280x800
   MOBILE=1 pnpm run test:tours     # iPhone 390x844 (touch)
   ```
   Env: `BASE_URL` (default `http://localhost:3005`), `CHROMIUM`
   (custom chromium path; sandboxes often need
   `CHROMIUM=/opt/pw-browsers/chromium`).

3. **Read the output.** Every step prints `ok` or `MISS` with its title and
   spotlight size. A `MISS` means the step's `targetSelector` didn't resolve
   to a *visible* element within the tour's ~1s prep budget. Fix by checking,
   in order: does the selector still exist in the source? is the element
   hidden behind a collapse/hide toggle (needs `reveal` / the control-bar
   auto-show)? does it need `inSidebar`, `navigate`, or a different
   `requiredTab`?

4. The **Karaoke mixer tour is not walked** (its targets only exist with a
   song loaded). If you changed `STEM_MIXER_TOUR_STEPS` or the mixer UI,
   verify those selectors statically against the components.

## Tour architecture (where things live)

- **Steps & tours**: `src/stores/app-store.ts` — `WALKTHROUGH_STEPS`
  (sectioned main walkthrough: practice / toolbar / editor / effects /
  settings-*), `PAGE_TOURS` + `PAGE_TOUR_CATALOG` (per-tab tours),
  `STEM_MIXER_TOUR_STEPS`, `PRACTICE_MODES_TOUR_STEPS`.
- **Engine**: `src/components/Walkthrough.tsx`. Per step it can: switch tabs
  (`requiredTab`), open the mobile sidebar drawer / expand the desktop
  collapsed rail (`inSidebar`), click through sub-navigation (`navigate:
  string[]`), expand an `aria-expanded` collapse toggle (`reveal`), and
  auto-un-hide a dismissed floating control bar (via the persisted
  `mp-<prefix>-control-hidden` flag). Everything it opens is restored when
  the tour ends. Targets only count when genuinely visible
  (`checkVisibility`); a missing target hides the spotlight and centres the
  tooltip.
- **Stable hooks**: prefer `data-tour="<page>.<thing>"` attributes (or
  existing `id`/`data-testid`) as `targetSelector`. Collapsible sidebar
  sections expose `data-collapsible="<storageKey>"` on their header for
  `reveal`. Never target hashed CSS-module classes.
- **Entry points**: welcome screen → Guide dialog (`GuideSelection.tsx`),
  sidebar Learn/Guide/Tour buttons, per-page offer toasts
  (`src/features/tours/usePageTourOffer.ts`, `offerTourOnce.ts`).
- **Survey interplay**: the onboarding survey defers while any tour surface
  is open (`tourSurfaceOpen` in `App.tsx`) — keep it that way.

## Coverage bar

Tours should cover **at least ~80% of the user-visible features** of the page
they describe. When adding a feature to a page that has a tour, add or update
a step (or fold it into an existing step's description) in the same PR.
