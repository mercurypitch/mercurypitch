// ============================================================
// Mercury Sing's host — the songs it listens for, and how one opens
// ============================================================
//
// The engine (mercury-sing-engine.ts) listens and matches the same way
// wherever it runs; what differs is the library around it. On the web it
// listens for every separated song, fingerprints one by decoding its vocal,
// and opens Karaoke Night by its address, rolling where the singer is
// (`webMercurySingHost`). The native Karaoke room listens for the room's own
// songs, the examples among them, fingerprinted from the notes each song
// already keeps, and cues the room instead (karaoke-room-find.ts).

import { getStemBlobUrl } from '@/db/services/uvr-service'
import { stripAudioExtension } from '@/lib/audio-file-name'
import { karaokeNightSessionUrl } from '@/lib/karaoke-night-link'
import { extractStemFingerprint } from '@/lib/shazam/stem-fingerprinter'
import type { MelodyFingerprint } from '@/lib/shazam/types'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive, initSessionStore } from '@/stores/uvr-store'

/** A song the stage listens for. */
export interface MercurySingSong {
  readonly sessionId: string
  readonly name: string
}

export interface MercurySingHost {
  /** The songs to listen for, named as the stage shows them. */
  readonly songs: () => Promise<readonly MercurySingSong[]>
  /**
   * A song's fingerprint, built once where it has none yet (the engine
   * keeps it); null when the song cannot have one.
   */
  readonly fingerprint: (
    song: MercurySingSong,
    /** True once the stage has closed: work not yet begun is skipped. */
    cancelled: () => boolean,
  ) => Promise<MelodyFingerprint | null>
  /** Open the song, rolling from `startAtSec`. The mic is already let go. */
  readonly launch: (song: MercurySingSong, startAtSec: number) => void
  /**
   * Said when the singing has stopped for a while and the mic is let go;
   * nothing is said without it (the room's sheet says it in its own words).
   */
  readonly heardNothing?: string
}

/** Library file names read better without their extension. */
const songName = (session: UvrSession): string => {
  const raw = session.originalFile?.name ?? ''
  const trimmed = stripAudioExtension(raw).trim()
  return trimmed === '' ? 'Your song' : trimmed
}

/** A separated song's fingerprint, from its vocal decoded whole. */
async function decodedFingerprint(
  song: MercurySingSong,
  cancelled: () => boolean,
): Promise<MelodyFingerprint | null> {
  // Both of these MUST be released whichever way this exits: the blob URL
  // pins the whole stem WAV in memory until revoked, and browsers cap live
  // AudioContexts — leak a few failed decodes and `new AudioContext()`
  // starts throwing for the entire app.
  let vocalUrl: string | null = null
  let audioCtx: AudioContext | null = null
  try {
    vocalUrl = await getStemBlobUrl(song.sessionId, 'vocal')
    if (vocalUrl === null) return null
    const response = await fetch(vocalUrl)
    const arrayBuffer = await response.arrayBuffer()
    audioCtx = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    // Closed while the vocal decoded: the seconds-long pitch walk is not
    // started for a stage nobody is looking at.
    if (cancelled()) return null
    const fp = await extractStemFingerprint(audioBuffer, {
      sessionId: song.sessionId,
      originalFileName: song.name,
    })
    if ('reason' in fp) {
      console.warn(
        '[mercury-sing] fingerprint skipped:',
        song.sessionId,
        fp.reason,
      )
      return null
    }
    return fp
  } finally {
    if (vocalUrl !== null) URL.revokeObjectURL(vocalUrl)
    if (audioCtx !== null) void audioCtx.close().catch(() => undefined)
  }
}

/** The web's: every separated song, and Karaoke Night by its address. */
export function webMercurySingHost(): MercurySingHost {
  return {
    songs: async () => {
      await initSessionStore()
      return getAllUvrSessionsReactive()
        .filter((s) => s.status === 'completed')
        .map((s) => ({ sessionId: s.sessionId, name: songName(s) }))
    },
    fingerprint: decodedFingerprint,
    heardNothing: 'Mercury Sing stopped — I did not hear singing.',
    launch: (song, startAtSec) => {
      const minutes = Math.floor(startAtSec / 60)
      const seconds = Math.floor(startAtSec % 60)
      showNotification(
        startAtSec > 0
          ? `Mercury Sing: "${song.name}" — joining you at ${String(minutes)}:${String(seconds).padStart(2, '0')}`
          : `Mercury Sing: "${song.name}" — from the top`,
        'success',
      )
      window.location.assign(
        karaokeNightSessionUrl(song.sessionId, {
          startAtSec,
          autoplay: true,
        }),
      )
    },
  }
}
