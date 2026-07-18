# Mobile Kit — the modular mobile design system

Everything mobile-specific lives in one place so any future surface is an
assembly job. Two layers: **tokens** (CSS custom properties in
`src/styles/app.css`) and **primitives** (`src/components/mobile/*` +
`src/lib/*` hooks). All primitives are extracted/generalized from
`KaraokeMobileStage.tsx` — the proven implementation — then the karaoke stage
is refactored to consume the kit (behavior-identical refactor, verified
against the standalone entry).

## 1. Tokens (added to `app.css :root`)

Existing tokens stay authoritative (colors, `--spacing-*` 4px scale,
`--text-*`, `--radius-*`, `--transition-*`). Additions:

```css
/* ── Safe areas ── (require viewport-fit=cover in every HTML entry) */
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
--safe-left: env(safe-area-inset-left, 0px);
--safe-right: env(safe-area-inset-right, 0px);

/* ── Touch ── */
--touch-target: 44px;        /* Apple HIG minimum; never render smaller hit areas */
--touch-gap: var(--spacing-md);

/* ── Mobile chrome metrics ── */
--tabbar-height: 54px;                                    /* content box, excl. safe area */
--tabbar-total: calc(var(--tabbar-height) + var(--safe-bottom));
--stage-viewport: 100dvh;                                 /* with 100vh fallback line above */

/* ── Spacing scale extension (larger rhythm for full-screen stages) ── */
--spacing-3xl: 2rem;   /* 32px */
--spacing-4xl: 3rem;   /* 48px */

/* ── Z-scale ── replaces ad-hoc numbers in NEW code; existing values
   migrate opportunistically. Ordering rationale in §4. */
--z-canvas-hud: 10;
--z-control-overlay: 30;
--z-tabbar: 380;
--z-stage: 450;        /* full-screen mobile stages (matches karaoke today) */
--z-focus: 500;        /* FocusMode (above stages by design) */
--z-sheet: 600;
--z-modal: 1000;
--z-toast: 1100;

/* ── Glass ── the Apple-Music translucency recipe, one place */
--glass-bg: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
--glass-blur: blur(18px) saturate(1.35);
--glass-border: color-mix(in srgb, var(--text-primary) 12%, transparent);
```

Notes:
- Every `backdrop-filter` needs the `-webkit-` twin (Safari). A `.glass`
  utility class in app.css applies the trio; kit components use it.
- Stages size with `height: 100vh; height: 100dvh;` (fallback ordering), and
  scrollable regions inside use `overscroll-behavior: contain`.
- Fonts: keep the brand faces (Inter/Outfit) but tighten the fallback stack to
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` so
  pre-font paint already looks native; self-hosting moves to the Capacitor
  phase (no Google Fonts CDN inside the native shell).

## 2. Primitives (`src/components/mobile/`)

All follow repo SolidJS rules (plain value props, no destructuring, signals →
memos → handlers → JSX). Each ships with its own `.module.css` consuming
tokens only — no hard-coded palette (the karaoke stage keeps its purple skin
by overriding tokens locally, which becomes the standard "skinning" mechanism).

| Primitive | Extracted from | Contract |
| --- | --- | --- |
| `StageShell` | `KaraokeMobileStage` root (`.module.css:5-32`) + `<Portal>` mount | Portal-to-body, `position:fixed`, `100dvh`, flex column, safe-area padding, scroll lock via `useScrollLock`. Props: `header?`, `footer?`, `children`. Owns nothing audio. |
| `BottomTabBar` | new (pattern: karaoke transport bar `.module.css:278-366`) | Fixed bottom glass bar, `--tabbar-total` tall, first 4 tabs of `visibleTabOrder(scope, mode)` practice group + **More**. Reads/writes `ui-store` `activeTab`. Hidden on desktop and inside stages that go full-immersive (stage opts out via prop). `data-tour="mobile-tabbar"`. |
| `MoreSheet` | new, composes `Sheet` | Remaining visible tabs + Settings as a tappable list with icons; footer hosts the desktop-upsell hint. |
| `Sheet` | song sheet (`KaraokeMobileStage.tsx:653-718`, `.module.css:394-476`) | Bottom sheet: backdrop tap-to-close, grab handle, `max-height: 68dvh`, safe-area bottom pad, `overscroll-behavior: contain`. **New:** drag-to-dismiss on the handle (pointer-capture pattern from the pill control; today's handle is decorative), focus trap (`useFocusTrap` like modals), `prefers-reduced-motion` respected. Props: `isOpen`, `close`, `title?`, `snap?: 'content' \| 'tall'`. |
| `OptionsSheet` | new, composes `Sheet` | The per-page "practice options" sheet: standardized section list (Setup / Playback / Guides) so all pages feel identical. Pages inject rows. |
| `PillControl` | vocal pill (`KaraokeMobileStage.tsx:184-272`) | Tap-to-toggle + vertical-drag-to-set-level in one control. Keeps: `setPointerCapture`, 7px drag threshold, `pointercancel` handling, keyboard `detail===0` guard, collapse-after-idle. Props: `value`, `onToggle`, `onLevel`, `icon`, `label`. |
| `Scrubber` | progress scrubber (`KaraokeMobileStage.tsx:275-332`) | Seek bar with scrub-preview signal, pointer capture, cancel-abort. Props: `position`, `duration`, `onSeek`, `disabled?`. |
| `TransportBar` | karaoke bottom bar | Standard stage footer: gradient scrim + safe-area pad; slots for left (mic), center (transport), right (More). Buttons are `--touch-target` circles with `:active` scale feedback (no `:hover` styling on coarse pointers). |
| `StatusChipRow` | new (pattern: `SingingCanvasHud` narrow chips) | Compact top-of-stage chips (key/scale, BPM, song name) that open the relevant sheet on tap. |
| `ScoreSheet` | new, composes `Sheet` | End-of-run score presented as a tall sheet instead of the desktop modal card; hosts the existing grade/stats/sparkline content components. |
| `DesktopHint` | new | The "More tools on MercuryPitch desktop" row (More sheet footer + options-sheet footer). Emits `desktop_hint_clicked`; action = copy link. |

## 3. Hooks & services (`src/lib/`)

| Item | Notes |
| --- | --- |
| `useScrollLock()` | Centralized body-scroll-lock manager with a **lock counter** — fixes the latent bug where two overlays fight over `document.body.style.overflow` (karaoke stage does this ad-hoc at `KaraokeMobileStage.tsx:88-92`). All stages/sheets/modals migrate to it. |
| `haptics.ts` | `tapLight()`, `success()`, `warning()` → `navigator.vibrate` where available (Android), no-op elsewhere; swaps to Capacitor Haptics via the platform layer later. Used on: transport taps, score reveal, streak/combo milestones. |
| `platform/` | `platform/index.ts` exposes `haptics`, `keepAwake`, `share`, `statusBar`, `openExternal` with web implementations (wake lock API, `navigator.share`, no-ops). The Capacitor build swaps one import. **No component may call a `@capacitor/*` API directly — ever.** |
| `use-viewport.ts` | Unchanged; stays the single detection source. Stages key off `isNarrow()` (width-only) exactly like karaoke — touch laptops keep desktop. |
| `swipe-nav` | Existing tab swipe (`App.tsx:456-503`) gains an exclusion: inside `[data-stage-canvas]` regions the gesture defers to canvas interactions (scrub/keys/markers). With the bottom bar present, swipe becomes a secondary affordance, not the primary one. |

## 4. Conventions (the rules that keep it modular)

1. **Engine above the branch.** Audio engines, controllers, mic state live in
   component setup (or `EngineContext`) — never inside either side of the
   `<Show when={!isNarrow()}>` swap. Rotation/resize swaps DOM only
   (`StemMixer.tsx:353-356` precedent).
2. **Stages are DOM+CSS-first.** Canvases render inside stages, but stage
   *chrome* is never canvas. Canvas components must already handle
   DPR/`ResizeObserver` resize (PitchCanvas and FallingNotesCanvas both do).
3. **Audio unlock rides every gesture.** Any stage control that can start
   sound routes through `unlockAudio` (`src/lib/audio-unlock.ts`) — stages
   mount from lazy chunks, so contexts are born suspended.
4. **Z-order is tokened.** New code uses `--z-*` only. FocusMode (500) >
   stage (450) > tab bar (380) is intentional: Focus Mode and stages cover
   the bar. MascotDock (900, above everything) gets demoted into the stage
   layer on mobile.
5. **Tap targets ≥ 44px, feedback via `:active`,** `-webkit-tap-highlight-color:
   transparent`, `touch-action: manipulation` on interactive chrome; no
   hover-only affordances on coarse pointers (the hover-expand "More" group
   pattern is banned inside stages).
6. **One sheet at a time.** Sheets stack on a single manager (open sheet
   closes the previous), so `useScrollLock` counting stays sane and Android
   back-button mapping stays trivial later.
7. **Tours are part of the definition of done.** Every stage exposes stable
   `data-tour` hooks and its page tour gains mobile-aware steps in the same
   PR.
8. **Skins override tokens, not components.** Karaoke's purple, Glass's
   glassmorphism, default GitHub-dark: all are token override blocks on the
   stage root.
9. **Iconography: SVG only — never emoji.** All UI icons are stroke-based
   inline SVGs (24 viewBox, 1.8px stroke, round caps/joins — SF-Symbols
   feel), extending the existing precedent in
   `src/components/shared/control-bar/icons.tsx`; kit icons live in
   `src/components/mobile/icons.tsx`. No emoji anywhere in product UI —
   not as icons, not as decorations, not in hint copy. Generated artwork
   (e.g. Higgsfield sets, like the voice-mirror legends/characters in
   `public/`) is welcome for *decorative imagery* — backdrops, character
   art, empty states — but chrome icons stay hand-drawn SVG so they render
   crisp at every DPR, inherit `currentColor`, and follow themes.

## 5. Extraction sequencing (Phase 0 PRs)

1. `feat/mobile-kit-tokens` — viewport-fit on 4 entries, tokens, `.glass`
   utility, z-token adoption in kit-adjacent files. Risk: viewport-fit
   changes layout on notched devices where safe-area was previously 0 —
   audit fixed/absolute chrome (`ConsentBanner`, `Notifications`, sidebar,
   FABs) in the same PR.
2. `feat/mobile-kit-primitives` — `Sheet`, `PillControl`, `Scrubber`,
   `StageShell`, `useScrollLock`, `haptics`, `platform/`;
   karaoke stage refactored onto them (behavior-identical; walk the
   standalone karaoke page + `/tour-check` karaoke tour before merge).
   `TransportBar` is deliberately deferred to Phase 1: karaoke's bottom
   bar stays bespoke, and the Singing stage — the first second consumer —
   defines the shared API (abstracting from one consumer guesses wrong).
   Note from implementation: kit tokens live in `styles/mobile-kit.css`,
   imported per entry — the standalone karaoke entry never loads app.css,
   and an undefined token silently invalidates every declaration using it.
3. `feat/mobile-tabbar` — `BottomTabBar` + `MoreSheet` + header slimming on
   narrow; tour hooks; audit assertion "tab bar visible & not overlapped".
