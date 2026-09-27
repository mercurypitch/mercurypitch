// ============================================================
// Glyphs the room's library shares with its Stage 2 rows
// ============================================================
//
// One place for the note a song row starts with, so the library sheet and
// the import queue's rows (KaraokeLibraryImports.tsx) draw the same one
// without either importing the other.

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
