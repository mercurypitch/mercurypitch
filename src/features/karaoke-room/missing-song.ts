// ============================================================
// A song of the singer's own that is no longer on this phone
// ============================================================
//
// The library lists every song the singer separated, from the session rows
// (karaoke-room-library.ts), and a row can outlive its stems. Cued, such a
// song would only reach the mixer's "Stems could not be loaded", whose Retry
// loads the same nothing again. The room leaves it off the stage and says
// instead what brings it back:
//
//   The server keeps a song's stems about a day (STEMS_KEPT_DAYS). Within
//   it, a song separated there downloads again for free, as a row of the
//   import queue.
//
//   After that, no server has the song, and the way back is Files: remove
//   it, then import it again, which separates it again and uses a song.
//
//   A read that failed (sessionStemPresence's 'unknown') has lost nothing,
//   and Remove would delete stems that are still there, so it says only to
//   try again.

import type { StemPresence } from '@/db/services/uvr-service'
import { sessionStemPresence } from '@/db/services/uvr-service'
import { thisDeviceLower } from '@/lib/device-noun'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import { showActionNotification, showNotification, } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { deleteUvrSession, getUvrSession } from '@/stores/uvr-store'
import { removeImportedSong, retryImport } from './karaoke-import-queue'
import type { RoomSong, RoomStems } from './karaoke-room-library'
import { STEMS_KEPT_DAYS } from './karaoke-songs'

const DAY_MS = 24 * 60 * 60 * 1000

/** What brings a song back that is no longer on this phone. */
export type MissingSongWay = 'download' | 'remove' | 'retry'

/** A song of the singer's own whose stems, opened, are not both there. */
export const isMissing = (song: RoomSong, stems: RoomStems): boolean =>
  song.kind === 'yours' && (stems.vocal === '' || stems.instrumental === '')

/**
 * The way back for a song whose stems could not be read. A song is younger
 * than the day the server keeps its stems when it was picked less than a day
 * ago: its stems were written after that, so they last at least as long.
 */
export function missingSongWay(
  session: Pick<UvrSession, 'apiSessionId' | 'processingMode' | 'createdAt'>,
  presence: StemPresence,
  now: number,
): MissingSongWay {
  if (presence === 'unknown') return 'retry'
  const onServer =
    session.processingMode === 'server' &&
    (session.apiSessionId ?? '') !== '' &&
    now - session.createdAt < STEMS_KEPT_DAYS * DAY_MS
  return KARAOKE_IMPORT && onServer ? 'download' : 'remove'
}

function removeSong(id: string): void {
  if (KARAOKE_IMPORT) void removeImportedSong(id)
  else void deleteUvrSession(id)
}

/** Tell the singer the song is not on this phone, and offer the way back. */
export async function sayMissingSong(song: RoomSong): Promise<void> {
  const session = getUvrSession(song.sessionId)
  if (session === undefined) return
  const presence = await sessionStemPresence(song.sessionId)
  const where = thisDeviceLower()
  const gone = `${song.title} is no longer on ${where}.`
  const way = missingSongWay(session, presence, Date.now())
  if (way === 'retry') {
    showNotification(
      `${song.title} could not be read from ${where}. Try it again in a moment.`,
      'warning',
    )
    return
  }
  // missingSongWay answers 'download' only where songs are imported. Saying
  // so here as well folds the offer and the queue out of a store build
  // (assert-bundle.mjs STAGE 2).
  if (KARAOKE_IMPORT && way === 'download') {
    showActionNotification(
      `${gone} The server still has it, and downloading it again uses no song.`,
      'warning',
      { label: 'Download again', onClick: () => retryImport(song.sessionId) },
    )
    return
  }
  showActionNotification(
    KARAOKE_IMPORT
      ? `${gone} Remove it, then import it again from Files. Separating it again uses a song.`
      : gone,
    'warning',
    { label: 'Remove', onClick: () => removeSong(song.sessionId) },
  )
}
