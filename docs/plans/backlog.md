# Backlog

**Status:** open — small items with no plan of their own.

What survived the 2026-07-28 docs audit. `docs/plans/feature-proposals.md`
listed 15 features; 12 shipped. Three did not, and are kept here so the 30 KB
proposal document does not have to be. The archived original is in
`<user-dotfiles>/mercurypitch/archive-2026-07/plans/feature-proposals.md`.

The mic latency wizard shipped 2026-08-08 — see
[mic-latency.ears.md](../specs/mic-latency.ears.md).

The practice timer shipped 2026-08-08 — see
[practice-timer.ears.md](../specs/practice-timer.ears.md).

## Theme auto-switch

Shipped 2026-08-08 (#455, in 0.8.1): System follows `prefers-color-scheme`,
Time of day swaps at 07:00/19:00, both with a chosen preset per side, and a
manual pick always wins. Lives in `src/stores/theme-store.ts`.
