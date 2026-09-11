// ============================================================
// AppleMark — the Apple glyph on the Sign in with Apple button
// ============================================================
//
// Monochrome and `currentColor`, which is what Apple's own Human Interface
// guidance asks for: the mark takes the button's foreground colour so the
// same component is correct on a light button and a dark one. 16px to match
// GoogleMark beside it, decorative, so it carries no accessible name — the
// button's own text is the label.

import type { Component } from 'solid-js'

export const AppleMark: Component = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M16.36 12.72c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.85-3.59 2.17-1.53 2.66-.39 6.59 1.1 8.74.73 1.05 1.6 2.23 2.74 2.19 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.1c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z" />
  </svg>
)
