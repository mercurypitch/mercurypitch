// ============================================================
// Glyphs the room's library shares with its Stage 2 rows
// ============================================================
//
// One place for the note a song row starts with, so the library sheet and
// the import queue's rows (KaraokeLibraryImports.tsx) draw the same one
// without either importing the other; and the sheets' close, and Find by
// singing's glyph, which the library sheet and the find sheet share.

import type { Component } from 'solid-js'

/** A note: a song in the list. */
export const NoteGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9.5 17.5V6.2l9-1.7v11" />
    <circle cx="7.2" cy="17.6" r="2.3" />
    <circle cx="16.2" cy="15.9" r="2.3" />
  </svg>
)

/**
 * A voice finding its song: a mouth's sound wave rising into a note. The
 * Songs sheet's Find by singing row.
 */
export const SingFindGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 13.5c1.2-2.4 2.4-2.4 3.6 0s2.4 2.4 3.6 0" />
    <path d="M15.2 17.1V7.5l5-1v9.1" />
    <circle cx="13.3" cy="17.1" r="1.9" />
    <circle cx="18.3" cy="15.6" r="1.9" />
  </svg>
)

/** Close: the room's sheets' own. */
export const CloseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)
