// ============================================================
// Glyphs for the Sing screen's exercise row and picker
// ============================================================
//
// Stroke and fill in currentColor, so the row and the cards colour them.
// The door to the picker reuses `ListRows` from src/components/icons.tsx.

import type { Component } from 'solid-js'

/** A lantern: its ring, cap, glass and foot, with a flame inside. */
export const LanternGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M10.2 4.6a1.8 1.8 0 0 1 3.6 0" />
    <path d="M8 7.4h8l-1.4-2.2H9.4z" />
    <rect x="7" y="7.4" width="10" height="11.4" rx="2.4" />
    <path d="M9 21h6" />
    <path d="M12 10.8c1.3 1.4 1.9 2.5 1.9 3.4a1.9 1.9 0 0 1-3.8 0c0-.9.6-2 1.9-3.4z" />
  </svg>
)

/** A small constellation: three stars joined by two lines. */
export const EchoGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5 17.5 11.5 7l7.5 6" />
    <circle cx="5" cy="17.5" r="2.1" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="7" r="2.1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="13" r="2.1" fill="currentColor" stroke="none" />
  </svg>
)

/** A glass moon bridge: one arch and its opening over a line of water. */
export const BridgeGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 16c2.6-6.4 5.6-9.5 9-9.5s6.4 3.1 9 9.5" />
    <path d="M7.5 16c1.3-3 2.8-4.5 4.5-4.5s3.2 1.5 4.5 4.5" />
    <path d="M3 16h4.5M16.5 16H21" />
    <path d="M4.5 19.6c1.2 0 1.2-.8 2.5-.8s1.2.8 2.5.8 1.2-.8 2.5-.8 1.2.8 2.5.8 1.2-.8 2.5-.8 1.2.8 2.5.8" />
  </svg>
)

/** A wave: one swell over a line of water, its crest dotted. */
export const WaveGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 17.5c2.2 0 3-1.6 4.4-4.6" />
    <path d="M16.6 12.9c1.4 3 2.2 4.6 4.4 4.6" />
    <circle cx="8.6" cy="10.4" r="0.95" fill="currentColor" stroke="none" />
    <circle cx="10.3" cy="8" r="0.95" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.2" r="0.95" fill="currentColor" stroke="none" />
    <circle cx="13.7" cy="8" r="0.95" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="10.4" r="0.95" fill="currentColor" stroke="none" />
    <path d="M3 20.6h18" />
  </svg>
)

/** The Warm-up: a path winding up through three stops. */
export const WarmUpGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12.6 19.4c-3.6 0-5.4-1.6-5.4-3.6s2.2-3 4.8-3.6 4.8-1.8 4.8-3.8-1.8-3.6-4.6-3.6" />
    <circle cx="13" cy="19.4" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12.2" r="1.9" fill="currentColor" stroke="none" />
    <circle cx="12.2" cy="4.8" r="1.9" fill="currentColor" stroke="none" />
  </svg>
)

/** Play, filled: the triangle on the row's accent disc. */
export const PlayGlyph: Component = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
)

/** A lighthouse: its roof and lit lantern over a tapering tower, two rays out. */
export const LighthouseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M10.4 11h3.2l1.1 9.5H9.3z" />
    <rect x="9.9" y="6.6" width="4.2" height="4.4" rx="0.6" />
    <path d="M9.4 6.6 12 4l2.6 2.6" />
    <path d="M7.5 20.5h9" />
    <path d="M3 7.6l4.6 0.9M3 10.6l4.6-0.9M21 7.6l-4.6 0.9M21 10.6l-4.6-0.9" />
  </svg>
)

/** A stage microphone on its stand, a spotlight's two edges falling on it. */
export const SpotlightGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="10" y="7" width="4" height="6.4" rx="2" />
    <path d="M12 13.4v6.6M9 20.5h6" />
    <path d="M10.4 3.5 5.6 9.6M13.6 3.5l4.8 6.1" />
  </svg>
)
