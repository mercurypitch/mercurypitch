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
// Its own small module: the import queue adds to it from the app's start,
// and needs nothing of the reader. The `mp_` prefix keeps both keys out of
// the settings sync: they are this phone's songs.

import { createSignal, untrack } from 'solid-js'
import { readIds, writeIds } from './karaoke-stored-ids'

/** The songs newly separated whose notes are still to be read. */
export const KARAOKE_NOTES_WANTED_KEY = 'mp_karaoke_notes_wanted'
/** Find by singing has been opened on this phone. */
export const KARAOKE_FIND_OPENED_KEY = 'mp_karaoke_find_opened'

function readFindOpened(): boolean {
  try {
    return localStorage.getItem(KARAOKE_FIND_OPENED_KEY) === 'true'
  } catch {
    return false
  }
}

const [wanted, setWanted] = createSignal<readonly string[]>(
  readIds(KARAOKE_NOTES_WANTED_KEY),
)
const [findOpened, setFindOpened] = createSignal(readFindOpened())

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

/** Tests only: both read again from storage, as a launch reads them. */
export function reloadNotesWantedForTests(): void {
  setWanted(readIds(KARAOKE_NOTES_WANTED_KEY))
  setFindOpened(readFindOpened())
}
