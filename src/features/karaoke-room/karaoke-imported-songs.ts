// ============================================================
// The singer's own songs on this phone, counted and removed together
// ============================================================
//
// Settings, Karaoke ("Songs on this phone") and Storage ("Imported songs")
// both say how many there are and how much of the phone they take, and both
// remove them all (plan S8 §9, §10). A song here is what the room's library
// lists as the singer's own. The examples are part of the app and stay.
//
// The size is the voice and the music, as each was recorded when it was
// saved (session-size.ts reads no audio). The original a song was separated
// from is not counted: it leaves the phone once the song is ready
// (karaoke-import-queue.ts), and the singer still has it in Files.

import { sessionSize } from '@/lib/session-size'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import { removeImportedSong } from './karaoke-import-queue'
import { roomLibrary } from './karaoke-room-library'

export interface ImportedSongs {
  readonly count: number
  /** Their voice and music, in bytes. Null when a song's size was never
   *  recorded: a smaller total would read as the true one. */
  readonly bytes: number | null
}

const ownIds = (): string[] =>
  roomLibrary()
    .filter((song) => song.kind === 'yours')
    .map((song) => song.sessionId)

/** The singer's own songs on this phone. Reactive. */
export function importedSongs(): ImportedSongs {
  const ids = new Set(ownIds())
  let bytes: number | null = 0
  for (const session of getAllUvrSessionsReactive()) {
    if (!ids.has(session.sessionId)) continue
    const size = sessionSize(session)
    bytes = bytes === null || !size.complete ? null : bytes + size.stemBytes
  }
  return { count: ids.size, bytes }
}

/**
 * Remove every one of them: its voice, its music and its row. One at a time,
 * as the studio removes one. Resolves to how many could not be removed,
 * which are still here.
 */
export async function removeAllImportedSongs(): Promise<number> {
  let stuck = 0
  for (const id of ownIds()) {
    if (!(await removeImportedSong(id))) stuck += 1
  }
  return stuck
}
