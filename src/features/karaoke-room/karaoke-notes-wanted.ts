// ============================================================
// The songs the Karaoke room reads the notes of, at rest
// ============================================================
//
// Find by singing knows a song by the notes it keeps (karaoke-room-find.ts),
// and the room reads them for a song that has none while it rests
// (karaoke-notes-reader.ts). Which songs is kept on this phone, so that it
// outlives the app. The owner's ask (1 Nov 2026) was new songs after their
// separation, and the examples the first time Find by singing is used:
//
//   - each song the import queue announces ready, newly separated, until
//     its notes are read or it leaves the phone;
//   - every song of the room, the examples among them, once Find by
//     singing has been opened here at least once.
//
// So is what a read came to when reading it again would come to the same:
// a vocal too long for this phone, none on it, one that would not open as
// a stream, or one with no singing in it. Each is kept by the song and the
// vocal it was read from (a vocal replaced in the studio is read again),
// so no launch walks a song again only to hear nothing again. A read that
// threw is not kept here: the next launch tries it again.
//
// Its own small module: the import queue adds to it from the app's start,
// and needs nothing of the reader. The `mp_` prefix keeps the keys out of
// the settings sync: they are this phone's songs.

import { createSignal, untrack } from 'solid-js'
import { readIds, writeIds } from './karaoke-stored-ids'

/** The songs newly separated whose notes are still to be read. */
export const KARAOKE_NOTES_WANTED_KEY = 'mp_karaoke_notes_wanted'
/** Find by singing has been opened on this phone. */
export const KARAOKE_FIND_OPENED_KEY = 'mp_karaoke_find_opened'
/** What reads came to that reading again would not change, by song. */
export const KARAOKE_NOTES_OUTCOMES_KEY = 'mp_karaoke_notes_outcomes'

/** What a read came to that reading the same vocal again would not change. */
export type FixedNotesOutcome =
  | 'too-long'
  | 'no-vocal'
  | 'no-stream'
  | 'no-notes'

const FIXED: readonly string[] = [
  'too-long',
  'no-vocal',
  'no-stream',
  'no-notes',
]

/** A song's fixed outcome, and the vocal it was read from (`vocalKey`). */
interface KeptOutcome {
  readonly vocal: string
  readonly outcome: FixedNotesOutcome
}

type KeptOutcomes = Readonly<Record<string, KeptOutcome>>

function readFindOpened(): boolean {
  try {
    return localStorage.getItem(KARAOKE_FIND_OPENED_KEY) === 'true'
  } catch {
    return false
  }
}

function isKeptOutcome(value: unknown): value is KeptOutcome {
  if (typeof value !== 'object' || value === null) return false
  const kept = value as Record<string, unknown>
  return typeof kept.vocal === 'string' && FIXED.includes(String(kept.outcome))
}

/** The outcomes kept on the phone; one that does not read as one is let go. */
function readOutcomes(): KeptOutcomes {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KARAOKE_NOTES_OUTCOMES_KEY) ?? '{}',
    ) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([, kept]) => isKeptOutcome(kept)),
    ) as KeptOutcomes
  } catch {
    return {}
  }
}

function writeOutcomes(next: KeptOutcomes): void {
  try {
    localStorage.setItem(KARAOKE_NOTES_OUTCOMES_KEY, JSON.stringify(next))
  } catch {
    // They still stand for this run; the next launch may read one again.
  }
}

const [wanted, setWanted] = createSignal<readonly string[]>(
  readIds(KARAOKE_NOTES_WANTED_KEY),
)
const [findOpened, setFindOpened] = createSignal(readFindOpened())
const [outcomes, setOutcomes] = createSignal<KeptOutcomes>(readOutcomes())

/** The songs newly separated whose notes are to be read, oldest first. */
export function notesWanted(): readonly string[] {
  return wanted()
}

/** A song just separated: its notes are read at the room's next rest. */
export function wantNotesRead(sessionId: string): void {
  const now = untrack(wanted)
  if (now.includes(sessionId)) return
  const next = [...now, sessionId]
  setWanted(next)
  writeIds(KARAOKE_NOTES_WANTED_KEY, next)
}

/** A song read, or gone from the phone: nothing left to read for it. */
export function forgetNotesWanted(sessionId: string): void {
  const now = untrack(wanted)
  if (!now.includes(sessionId)) return
  const next = now.filter((id) => id !== sessionId)
  setWanted(next)
  writeIds(KARAOKE_NOTES_WANTED_KEY, next)
}

/** Find by singing has been opened on this phone at least once. */
export function findOpenedOnce(): boolean {
  return findOpened()
}

/** Find by singing opening: from now on every song of the room is read. */
export function markFindOpened(): void {
  if (untrack(findOpened)) return
  setFindOpened(true)
  try {
    localStorage.setItem(KARAOKE_FIND_OPENED_KEY, 'true')
  } catch {
    // Every song is still read in this run; the next launch asks again.
  }
}

/**
 * What reading the song's vocal came to, where reading it again would come
 * to the same; null when nothing is kept for this vocal. Reactive.
 */
export function notesOutcome(
  sessionId: string,
  vocal: string,
): FixedNotesOutcome | null {
  const kept = outcomes()[sessionId]
  return kept !== undefined && kept.vocal === vocal ? kept.outcome : null
}

/** Keep what reading this vocal came to, so no launch reads it again. */
export function keepNotesOutcome(
  sessionId: string,
  vocal: string,
  outcome: FixedNotesOutcome,
): void {
  const next = { ...untrack(outcomes), [sessionId]: { vocal, outcome } }
  setOutcomes(next)
  writeOutcomes(next)
}

/**
 * Let go of everything kept for the songs `gone` says have left the phone,
 * so what is kept stays as long as the songs are.
 */
export function letGoOfNotesFor(gone: (sessionId: string) => boolean): void {
  for (const sessionId of untrack(wanted)) {
    if (gone(sessionId)) forgetNotesWanted(sessionId)
  }
  const kept = untrack(outcomes)
  const staying = Object.entries(kept).filter(([id]) => !gone(id))
  if (staying.length === Object.keys(kept).length) return
  const next = Object.fromEntries(staying)
  setOutcomes(next)
  writeOutcomes(next)
}

/** Tests only: all of it read again from storage, as a launch reads it. */
export function reloadNotesWantedForTests(): void {
  setWanted(readIds(KARAOKE_NOTES_WANTED_KEY))
  setFindOpened(readFindOpened())
  setOutcomes(readOutcomes())
}
