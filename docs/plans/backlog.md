# Backlog

**Status:** open — small items with no plan of their own.

What survived the 2026-07-28 docs audit. `docs/plans/feature-proposals.md`
listed 15 features; 12 shipped. These three did not, and are kept here so the
30 KB proposal document does not have to be. The archived original is in
`<user-dotfiles>/mercurypitch/archive-2026-07/plans/feature-proposals.md`.

## Microphone latency calibration wizard

Measure round-trip input latency and offset recorded notes by it.

Not to be confused with `src/features/mic-feedback/auto-calibrate.ts`, which
samples ambient level for ~1s to pick a sensitivity preset — that is gain, not
latency. Nothing currently measures latency.

Relevant: `src/lib/mic-manager.ts`, `src/lib/audio-engine.ts`.

## Practice timer with break reminders

Elapsed-practice timer with a configurable prompt to rest. Vocal-health
motivated — long unbroken singing is the failure mode.

Practice minutes are already tracked (`src/db/services/practice-minutes.ts`),
so the data exists; this is the surfacing plus a settings toggle.

## Theme auto-switch

Follow `prefers-color-scheme` and switch between two chosen presets, rather
than holding one fixed theme.

`src/stores/theme-store.ts` has nine presets and persists one choice. This
needs a second stored choice plus a media-query listener. Nothing in `src/`
currently reads `prefers-color-scheme`.
