// ============================================================
// Find a song by singing it, in the Karaoke room
// ============================================================
//
// The web's Mercury Sing listens for every separated song and opens Karaoke
// Night by its address (mercury-sing-host.ts). The room's listens for the
// room's own library, the singer's songs and the examples, and cues the song
// on its own stage where the singer has got to (the engine's launch math).
//
// A song is fingerprinted from the notes it already keeps, its saved
// analysis (an example ships its own, bundled-notes.ts), never by decoding
// its vocal: the phone cannot afford a whole stem in memory (audit K1). A
// song with no notes yet is listed and opens from the top when tapped, and
// is matched once it has some.

import type { Accessor } from 'solid-js'
import { createSignal, untrack } from 'solid-js'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import type { MercurySingCandidateView, MercurySingHost, MercurySingLibraryEntry, MercurySingStatus, } from '@/features/mercury-sing/mercury-sing-engine'
import { showNotification } from '@/stores/notifications-store'
import type { RoomSong } from './karaoke-room-library'

// The room meets Mercury Sing here, by its types, and in the listening
// (KaraokeFindListening.tsx), which creates the engine and is loaded only
// when the sheet first opens.
export type {
  MercurySingCandidateView,
  MercurySingHost,
  MercurySingLibraryEntry,
}

/** What the sheet says under its title, by the engine's state. */
export const FIND_STATUS: Record<MercurySingStatus, string> = {
  starting: 'Getting the microphone ready.',
  listening: 'Sing a bit of any song in the list, any part.',
  quiet: 'Stopped listening when the singing stopped.',
  'mic-denied': 'Merc needs the microphone to hear you.',
  'no-library': 'There are no songs to listen for yet.',
  launching: 'Joining you.',
}

export interface RoomFindInput {
  /** The room's library as it is now. */
  readonly songs: () => readonly RoomSong[]
  /** Cue the song on the stage, playing from `startAtSec`. */
  readonly cue: (sessionId: string, startAtSec: number) => void
}

export function roomFindHost(input: RoomFindInput): MercurySingHost {
  return {
    songs: () =>
      Promise.resolve(
        input
          .songs()
          .map((song) => ({ sessionId: song.sessionId, name: song.title })),
      ),
    fingerprint: async (song) => {
      const saved = await loadPitchAnalysisFromDb(song.sessionId)
      if (saved === null) return null
      // Loaded with the listening, not with the room.
      const { fingerprintFromNotes } =
        await import('@/lib/shazam/stem-fingerprinter')
      const fp = fingerprintFromNotes(saved.mergedNotes, {
        sessionId: song.sessionId,
        originalFileName: song.name,
      })
      return 'reason' in fp ? null : fp
    },
    launch: (song, startAtSec) => input.cue(song.sessionId, startAtSec),
  }
}

export interface RoomFindDeps {
  /** The room's library as it is now. */
  readonly songs: () => readonly RoomSong[]
  /** Before the sheet opens: what is over the stage closes, its song stops. */
  readonly clearStage: () => void
  /** A song found, played on the stage from `startAtSec`. */
  readonly play: (song: RoomSong, startAtSec: number) => void
}

/** The room's Find by singing: whether its sheet is open, and its host. */
export interface RoomFind {
  readonly isOpen: Accessor<boolean>
  readonly open: () => void
  /** Closes the sheet; true when it was open, for Back. */
  readonly close: () => boolean
  readonly host: MercurySingHost
}

/**
 * Find by singing, from the Songs sheet. The song on the stage stops before
 * the sheet opens, or its own sound would be matched and the sheet wants
 * the mic; one still loading must not start under it (the stage's autoPlay
 * is off while it is open). A song found is played where the singer has
 * got to.
 */
export function createRoomFind(deps: RoomFindDeps): RoomFind {
  const [isOpen, setOpen] = createSignal(false)
  const close = (): boolean => {
    if (!isOpen()) return false
    setOpen(false)
    return true
  }
  const host = roomFindHost({
    songs: deps.songs,
    cue: (sessionId, startAtSec) => {
      setOpen(false)
      const song = untrack(deps.songs).find(
        (row) => row.sessionId === sessionId,
      )
      if (song === undefined) {
        showNotification('That song is not in the room any more.', 'info')
        return
      }
      deps.play(song, startAtSec)
    },
  })
  const open = (): void => {
    deps.clearStage()
    setOpen(true)
  }
  return { isOpen, open, close, host }
}
