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

/** Play, filled: the triangle on the row's accent disc. */
export const PlayGlyph: Component = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
  </svg>
)
