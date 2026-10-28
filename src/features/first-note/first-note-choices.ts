// ============================================================
// First note's choices — where a run's songs come from, and the words
// ============================================================
//
// Two choices the singer makes in the room's Songs sheet, kept on this
// device (the `mp_` prefix keeps them out of the settings sync):
//
//   the songs   the examples the app ships (the default), the singer's own
//               songs, or a mix of the two
//   the words   "Show the words": the words of the line the singer comes in
//               on, while the band counts in and in their turn. The owner
//               asked for an optional hint (28 Oct 2026); it ships off by
//               default, our choice, so the room stays ear first
//
// Built on first read, as the room's bests are (first-note-store.ts), so
// nothing at this module's top level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export const FIRST_NOTE_SOURCE_KEY = 'mp_first_note_source'
export const FIRST_NOTE_WORDS_KEY = 'mp_first_note_words'

/** Where a run's songs come from. */
export type FirstNoteSource = 'examples' | 'yours' | 'mix'

export const FIRST_NOTE_SOURCES: readonly FirstNoteSource[] = [
  'examples',
  'yours',
  'mix',
]

const isSource = (value: unknown): value is FirstNoteSource =>
  (FIRST_NOTE_SOURCES as readonly unknown[]).includes(value)
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'

let source: Signal<FirstNoteSource> | null = null
let words: Signal<boolean> | null = null

function sourceSignal(): Signal<FirstNoteSource> {
  source ??= createPersistedSignal<FirstNoteSource>(
    FIRST_NOTE_SOURCE_KEY,
    'examples',
    { validator: isSource },
  )
  return source
}

function wordsSignal(): Signal<boolean> {
  words ??= createPersistedSignal<boolean>(FIRST_NOTE_WORDS_KEY, false, {
    validator: isBoolean,
  })
  return words
}

/** Where the next run's songs come from. */
export function firstNoteSource(): FirstNoteSource {
  return sourceSignal()[0]()
}

export function setFirstNoteSource(next: FirstNoteSource): void {
  sourceSignal()[1](next)
}

/** The chosen songs include the singer's own. */
export function sourceHasOwnSongs(): boolean {
  return firstNoteSource() !== 'examples'
}

/** "Show the words" is on. */
export function firstNoteShowsWords(): boolean {
  return wordsSignal()[0]()
}

export function setFirstNoteShowsWords(on: boolean): void {
  wordsSignal()[1](on)
}

/** Tests only: the choices as a new install has them. */
export function resetFirstNoteChoicesForTests(): void {
  source = null
  words = null
  try {
    localStorage.removeItem(FIRST_NOTE_SOURCE_KEY)
    localStorage.removeItem(FIRST_NOTE_WORDS_KEY)
  } catch {
    // Nothing persisted to clear.
  }
}
