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
// is matched once it has some. The room reads them itself while it rests
// (karaoke-notes-reader.ts): for a song just separated, and once the sheet
// has been opened, for every song. So the sheet's open is remembered, and
// the room reads nothing while the sheet holds the mic; a song read while
// the sheet is quiet is found once it listens again. Under a song it cannot
// find yet, the sheet says why in the room's words (`notReadyWords`).

import type { Accessor } from 'solid-js'
import { createSignal, untrack } from 'solid-js'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import type { MercurySingCandidateView, MercurySingHost, MercurySingLibraryEntry, MercurySingStatus, } from '@/features/mercury-sing/mercury-sing-engine'
import { showNotification } from '@/stores/notifications-store'
import type { KaraokeNotesState } from './karaoke-notes-reader'
import { markFindOpened } from './karaoke-notes-wanted'
import type { RoomSong } from './karaoke-room-library'

// The room meets Mercury Sing here, by its types, and in the listening
// (KaraokeFindListening.tsx), which creates the engine and is loaded only
// when the sheet first opens.
export type {
  MercurySingCandidateView,
  MercurySingHost,
  MercurySingLibraryEntry,
  MercurySingStatus,
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

/**
 * Whether the listening holds the mic, or is about to: from its start until
 * the singing stops, the mic is refused, or there is nothing to listen for.
 */
export function holdsMic(status: MercurySingStatus): boolean {
  return (
    status === 'starting' || status === 'listening' || status === 'launching'
  )
}

/** What the sheet says under a song nothing has read the notes of. */
export const TURN_NOTES_ON = 'Turn its notes on once to find it by singing'

/** What the listening is doing, for the words under a song. */
export interface ListeningNow {
  /** The engine is still fingerprinting songs for this listening. */
  readonly fingerprinting: boolean
  readonly holdsMic: boolean
}

/**
 * What the sheet says under a song it cannot find yet, by what the room
 * knows of its notes (karaoke-notes-reader.ts) and what the listening is
 * doing. A song with notes being fingerprinted is getting ready, never one
 * to turn the notes on for.
 */
export function notReadyWords(
  notes: KaraokeNotesState,
  listening: ListeningNow,
): string {
  if (notes.kind === 'reading') {
    return `Getting ready to find, ${notes.percent}%`
  }
  if (notes.kind === 'failed') {
    if (notes.why === 'too-long') return 'Too long for this phone to find'
    return notes.why === 'unreadable' ? 'Could not be read' : TURN_NOTES_ON
  }
  if (listening.fingerprinting) return 'Getting ready to find'
  if (notes.kind === 'waiting') {
    return listening.holdsMic
      ? 'Gets ready when you stop singing'
      : 'Getting ready to find'
  }
  return notes.kind === 'read'
    ? 'Ready to find when you listen again'
    : TURN_NOTES_ON
}

export interface RoomFindInput {
  /** The room's library as it is now. */
  readonly songs: () => readonly RoomSong[]
  /** Resolves once the bundled examples are in, with their notes. */
  readonly seeded: () => Promise<void>
  /** Cue the song on the stage, playing from `startAtSec`. */
  readonly cue: (sessionId: string, startAtSec: number) => void
}

export function roomFindHost(input: RoomFindInput): MercurySingHost {
  return {
    // After the seed, so an example is listed with its notes there to
    // fingerprint. The room cues nothing before it either, so this is a
    // guard: a sheet opened earlier would list them unfindable.
    songs: async () => {
      await input.seeded().catch(() => undefined)
      return input
        .songs()
        .map((song) => ({ sessionId: song.sessionId, name: song.title }))
    },
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
  /** Resolves once the bundled examples are in, with their notes. */
  readonly seeded: () => Promise<void>
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
  /** The sheet is open and its listening holds the mic, or is about to. */
  readonly listening: Accessor<boolean>
  /** The listening saying whether it holds the mic (`holdsMic`). */
  readonly heldMic: (held: boolean) => void
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
  // Held from the open: the listening is loaded and opens the mic after it.
  const [micHeld, setMicHeld] = createSignal(true)
  const close = (): boolean => {
    if (!isOpen()) return false
    setOpen(false)
    return true
  }
  const host = roomFindHost({
    songs: deps.songs,
    seeded: deps.seeded,
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
    // From now on the room reads every song's notes at rest, the examples
    // among them, so each can be found by singing (karaoke-notes-wanted.ts).
    markFindOpened()
    setMicHeld(true)
    setOpen(true)
  }
  return {
    isOpen,
    open,
    close,
    host,
    listening: () => isOpen() && micHeld(),
    heldMic: setMicHeld,
  }
}
