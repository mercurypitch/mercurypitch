# Exercises — alignment spec (Phase 3)

Exercises is the most mobile-mature surface already (`mobile-polish.css:76-252`
reworks the runner; `scripts/audit-exercises-mobile.mjs` + the
`mobile-ui-check` skill gate it). This phase is **alignment, not redesign**:
adopt the kit so Exercises looks and behaves like the Singing/Piano stages,
and promote its ad-hoc mobile CSS into kit primitives. No `<Show>` swap — the
existing responsive approach stays, upgraded in place (18 drills through one
`ExerciseShell` means CSS-level alignment reaches everything at once).

## Menu (`ExerciseMenu.tsx`)

- Large-title header ("Exercises") with the kit type ramp; difficulty filter
  pills become a horizontally scrolling chip row (44px tall, no wrap).
- `WeaknessPanel` and Recent Sessions restyle as kit cards; card grid stays
  single-column ≤600px (existing `exercises.css:1618` rule, re-tokened).
- Cards get `:active` press feedback + `tapLight()` haptic; hover-only
  affordances get touch equivalents.
- Bottom padding accounts for `--tabbar-total` (the new tab bar) — the menu
  scrolls under the glass bar, Apple Music style.

## Runner (`ExerciseShell.tsx`)

Keep the current structure (it works); swap bespoke pieces for kit:

| Today (mobile-polish.css) | Becomes |
| --- | --- |
| Stop as hand-rolled round corner FAB | `TransportBar` slot (Stop primary) — consistent with other stages; FAB retained only where metrics fill the width |
| Sticky full-width Start CTA | Kit sticky-CTA pattern (same component as stages' primary action; safe-area aware) |
| Idle settings inline column (note pickers, selects, auto-timer) | `OptionsSheet` sections when >2 settings; ≤2 stay inline (drills like Long Note keep their single note picker in place — don't bury a one-tap setup) |
| Recent-scores card pulled into flow | Kit card token pass only |
| Result card | `ScoreSheet` variant (compact) with `success()` haptic; "New best!" celebrates with the existing delta copy |
| Help "?" panel | `Sheet` (title = drill name) |

- `ExercisePitchTracker` stays; its 148px mobile height becomes a token
  (`--pitch-tracker-h-mobile`).
- Spacebar shortcuts remain (harmless on mobile, useful with BT keyboards).
- Mic button honors `--touch-target`; level ring shared with stage mic pills.

## What does NOT change

- The 18 drill implementations and their metrics/scoring.
- `use-base-exercise` engine wiring, adaptive difficulty, weakness analysis.
- The audit script contract — it must keep passing throughout; its checks
  extend rather than reset (see below).

## Routine Runner / Guided Warmup note

These two compose other drills and have the heaviest setup screens (36-note
comfort grid already has a 6-col mobile rule). They adopt `OptionsSheet` for
setup so the Start CTA is always above the fold — the changelog's "Guided
Warmup usable on a phone again" fix becomes structural instead of patched.

## Tours & audit

- `EXERCISES_TOUR_STEPS` re-targeted where selectors change (menu chips,
  options sheet trigger); ≥80% feature coverage rule applies.
- `audit-exercises-mobile.mjs` gains assertions: tab bar visible on menu and
  hidden/undocked during an active run only if the stage opts out; options
  sheet rows ≥44px; no regression on the existing overflow/Stop-overlap/CTA
  checks (they are the contract).

## Analytics

`mobile_stage_engaged{page:exercises}` (Start tapped on narrow),
`mobile_options_opened{page:exercises}`, plus the existing exercise events.
