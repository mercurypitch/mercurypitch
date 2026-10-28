// ============================================================
// First note's choices — where a run's songs come from
// ============================================================
//
// The singer chooses in the room's Songs sheet, and the choice is kept on
// this device (the `mp_` prefix keeps it out of the settings sync): the
// examples the app ships (the default), the singer's own songs, or a mix
// of the two.
//
// Built on first read, as the room's bests are (first-note-store.ts), so
// nothing at this module's top level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export const FIRST_NOTE_SOURCE_KEY = 'mp_first_note_source'

/** Where a run's songs come from. */
export type FirstNoteSource = 'examples' | 'yours' | 'mix'

export const FIRST_NOTE_SOURCES: readonly FirstNoteSource[] = [
  'examples',
  'yours',
  'mix',
]

const isSource = (value: unknown): value is FirstNoteSource =>
  (FIRST_NOTE_SOURCES as readonly unknown[]).includes(value)

let source: Signal<FirstNoteSource> | null = null

function sourceSignal(): Signal<FirstNoteSource> {
  source ??= createPersistedSignal<FirstNoteSource>(
    FIRST_NOTE_SOURCE_KEY,
    'examples',
    { validator: isSource },
  )
  return source
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

/** Tests only: the choice as a new install has it. */
export function resetFirstNoteChoicesForTests(): void {
  source = null
  try {
    localStorage.removeItem(FIRST_NOTE_SOURCE_KEY)
  } catch {
    // Nothing persisted to clear.
  }
}
