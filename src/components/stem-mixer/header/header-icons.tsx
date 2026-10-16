// The mixer header's own icons, kept out of the shared icon set.
// ============================================================
//
// Every icon in src/components/icons.tsx rides the `shared-icons` chunk,
// which every standalone page loads on its first paint, under a byte
// budget (scripts/assert-drum-night-bundle.mjs and
// assert-first-paint-budgets.mjs). These five are drawn only by the stem
// mixer's header, so they live beside it and load with the mixer instead.
// Same grid as the shared set: 24 px viewBox, 2 px stroke, round caps.

import type { Component } from 'solid-js'

// PitchCurve — a sung line over a floor: the mixer header's Pitch panel
// (analysis, notes, settings). It was a gear, which every app uses for
// settings and which told nobody this is where the melody lives.
export const PitchCurve: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 16c2.2 0 2.6-5 5-5s2.4 3 4.6 3 2.6-7 5-7 2.4 2 3.4 2" />
    <path d="M3 20h18" opacity="0.45" />
  </svg>
)

// Backdrop — a framed picture with hills and a sun: the stage's backdrop
// and its transparency. The curtains mean Karaoke Night alone.
export const Backdrop: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
    <circle cx="15.5" cy="8.5" r="1.5" />
  </svg>
)

// ArrowUpRight — "this opens another page": the tail of a link button.
export const ArrowUpRight: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 12}
    height={p.size ?? 12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 16L16 8" />
    <path d="M9.5 8H16v6.5" />
  </svg>
)

// ZenLines — three lines of lyrics, the last one short: Zen mode, the
// lyrics-first view. It was drawn inline in the mixer's header.
export const ZenLines: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M4 12h16M4 17h9" />
  </svg>
)

// SongList — lines of a list beside a note: the songs and playlists
// sidebar.
export const SongList: Component<{ size?: number }> = (p) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 6h11M4 12h11M4 18h7" />
    <path d="M19 6v8.55A2.5 2.5 0 1 0 20.5 17V9h2.5" stroke-width="1.8" />
  </svg>
)
