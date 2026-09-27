// ============================================================
// Which way the Karaoke room held the last song
// ============================================================
//
// A hosted room holds a stem one of three ways (useStemMixerAudioController,
// loadOne): it streams it through AudioDecoder; it refuses it, because it
// cannot stream here and the stem is too big to decode whole; or it decodes
// it whole. Which one a phone took is the whole question on a device round,
// and a phone has no console to ask. So every decision is written down
// twice:
//
//   In the audio record (src/lib/audio-diagnostics.ts), one line per stem
//   and one per song, which the Developer screen's Copy report carries.
//
//   In storage, the last song as one record, which the Karaoke audio
//   section reads. Written BEFORE a whole decode starts, because that
//   decode is what iOS kills the app for, and a record kept only in memory
//   dies with it. A song still "loading" after a relaunch is the answer to
//   the crash test: the phone did not survive it.
//
// Only a native test build keeps this (the controller asks for it behind
// VITE_PORTABLE_CONSOLE), so the web and the store build carry none of it.

import { recordAudioDiagnostic } from '@/lib/audio-diagnostics'

/** How one stem was held. */
export type StemPath = 'stream' | 'refused' | 'whole'
/** How the song was held: every stem the same way, or not. */
export type SongPath = StemPath | 'mixed'

export const LAST_SONG_PATH_KEY = 'mp:dev-karaoke-last-song-path'

/** The audio record's source for every line written here. */
export const PATH_SOURCE = 'karaoke'

export interface StemDecision {
  /** The stem's file name, which tells two stems of one song apart. */
  name: string
  path: StemPath
  /** The compressed file, as downloaded. */
  bytes: number
  /**
   * What a whole decode of it holds at the room's rate, estimated from its
   * container. Null when the container could not be read.
   */
  wholeDecodeBytes: number | null
  /** As a decoder is configured with it: 'mp3', 'mp4a.40.2'. */
  codec?: string | null
  sampleRate?: number | null
  channelCount?: number | null
  /** Refused by the guard, and decoded whole anyway by the crash test. */
  pastGuard?: boolean
}

export interface SongPathRecord {
  path: SongPath
  /** Every stem's compressed size, added up. */
  songBytes: number
  /** A whole decode of every stem; null when one could not be estimated. */
  wholeDecodeBytes: number | null
  /** What the room holds once the stems are in. Null until one is held. */
  residentBytes: number | null
  /** The first stem's codec. */
  codec: string | null
  sampleRate: number | null
  channelCount: number | null
  /** A song the guard refuses, decoded whole anyway by the crash test. */
  pastGuard: boolean
  stems: number
  /** Loading until every stem is held or refused. */
  state: 'loading' | 'done'
  /** When the room began holding it, ISO. */
  startedAt: string
}

export interface SongPathLog {
  /**
   * A stem's path, said before it is taken: a whole decode that kills the
   * app is already written down by then.
   */
  decided(stem: StemDecision): void
  /** A stem is in, and this is what it holds. */
  held(name: string, residentBytes: number): void
  /** Every stem is held or refused, or the room was left. */
  finished(): void
}

const MIB = 1024 * 1024

/** One decimal of a megabyte, for a line a person reads. */
export function megabytes(bytes: number): string {
  return (bytes / MIB).toFixed(1)
}

/** The song so far, which the room began holding in this launch. */
let current: SongPathRecord | null = null

function persist(record: SongPathRecord): void {
  try {
    localStorage.setItem(LAST_SONG_PATH_KEY, JSON.stringify(record))
  } catch {
    // Storage refused: the audio record still has every line.
  }
}

function songPathOf(paths: readonly StemPath[]): SongPath {
  const first = paths[0]
  return paths.every((path) => path === first) ? first : 'mixed'
}

export interface SongPathLogOptions {
  /**
   * What the room was told about streaming as it opened the song: false on
   * a phone with no AudioDecoder, and on one forced down the no-streaming
   * path (stream-switches.ts).
   */
  streams: boolean
  now?: () => Date
}

/** One song's log. The room makes one per load. */
export function createSongPathLog(options: SongPathLogOptions): SongPathLog {
  const now = options.now ?? (() => new Date())
  const paths: StemPath[] = []
  const estimates: Array<number | null> = []
  const resident = new Map<string, number>()
  const record: SongPathRecord = {
    path: 'stream',
    songBytes: 0,
    wholeDecodeBytes: null,
    residentBytes: null,
    codec: null,
    sampleRate: null,
    channelCount: null,
    pastGuard: false,
    stems: 0,
    state: 'loading',
    startedAt: now().toISOString(),
  }
  current = record
  let finished = false
  // The phone's own answer beside the room's, so a copied report tells a
  // phone with no AudioDecoder from one the Developer screen forced.
  recordAudioDiagnostic(PATH_SOURCE, 'song-open', {
    audioDecoder: typeof AudioDecoder === 'undefined' ? 'absent' : 'present',
    streams: options.streams,
  })

  const residentTotal = (): number | null => {
    if (resident.size === 0) return null
    let sum = 0
    for (const bytes of resident.values()) sum += bytes
    return sum
  }

  return {
    decided(stem) {
      paths.push(stem.path)
      estimates.push(stem.wholeDecodeBytes)
      record.path = songPathOf(paths)
      record.songBytes += stem.bytes
      record.wholeDecodeBytes = estimates.every((e) => e !== null)
        ? estimates.reduce<number>((sum, e) => sum + (e ?? 0), 0)
        : null
      record.codec ??= stem.codec ?? null
      record.sampleRate ??= stem.sampleRate ?? null
      record.channelCount ??= stem.channelCount ?? null
      record.pastGuard ||= stem.pastGuard === true
      record.stems = paths.length
      persist(record)
      recordAudioDiagnostic(
        PATH_SOURCE,
        `stem-${stem.path}`,
        {
          stem: stem.name,
          bytes: stem.bytes,
          wholeDecodeMB:
            stem.wholeDecodeBytes === null
              ? 'unknown'
              : megabytes(stem.wholeDecodeBytes),
          codec: stem.codec ?? 'unknown',
          ...(stem.pastGuard === true ? { pastGuard: true } : {}),
        },
        stem.path === 'refused',
      )
    },
    held(name, residentBytes) {
      resident.set(name, residentBytes)
      record.residentBytes = residentTotal()
      persist(record)
      recordAudioDiagnostic(PATH_SOURCE, 'stem-held', {
        stem: name,
        residentMB: megabytes(residentBytes),
      })
    },
    finished() {
      if (finished) return
      finished = true
      record.state = 'done'
      persist(record)
      if (current === record) current = null
      recordAudioDiagnostic(
        PATH_SOURCE,
        'song-path',
        {
          path: record.stems === 0 ? 'none' : record.path,
          stems: record.stems,
          songMB: megabytes(record.songBytes),
          wholeDecodeMB:
            record.wholeDecodeBytes === null
              ? 'unknown'
              : megabytes(record.wholeDecodeBytes),
          residentMB:
            record.residentBytes === null
              ? 'none'
              : megabytes(record.residentBytes),
          ...(record.pastGuard ? { pastGuard: true } : {}),
        },
        record.path === 'refused',
      )
    },
  }
}

/** The last song the room began holding, in this launch or an earlier one. */
export function readLastSongPath(): SongPathRecord | null {
  try {
    const raw = localStorage.getItem(LAST_SONG_PATH_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<SongPathRecord> | null
    if (parsed === null || typeof parsed !== 'object') return null
    if (typeof parsed.path !== 'string' || typeof parsed.state !== 'string')
      return null
    return parsed as SongPathRecord
  } catch {
    return null
  }
}

/** Whether this launch is the one holding that record right now. */
export function isHoldingNow(record: SongPathRecord): boolean {
  return current !== null && current.startedAt === record.startedAt
}

const PATH_WORDS: Record<SongPath, string> = {
  stream: 'streamed',
  refused: 'refused by the guard',
  whole: 'decoded whole',
  mixed: 'streamed in part, decoded whole in part',
}

/** The Karaoke audio section's line for the last song. */
export function describeSongPath(record: SongPathRecord | null): string {
  if (record === null) return 'none yet: open a song in the Karaoke room'
  if (record.stems === 0) return 'none yet: the last load held no stem'
  const parts = [
    record.pastGuard && record.path === 'whole'
      ? 'decoded whole past the guard (crash test)'
      : PATH_WORDS[record.path],
    `${megabytes(record.songBytes)} MB in ${record.stems} ${record.stems === 1 ? 'stem' : 'stems'}`,
    record.wholeDecodeBytes === null
      ? 'whole decode: unknown'
      : record.path === 'whole'
        ? `whole decode about ${megabytes(record.wholeDecodeBytes)} MB`
        : `a whole decode would hold about ${megabytes(record.wholeDecodeBytes)} MB`,
  ]
  if (record.residentBytes !== null) {
    parts.push(`holds ${megabytes(record.residentBytes)} MB`)
  }
  if (record.codec !== null) parts.push(record.codec)
  if (record.state === 'loading') {
    parts.push(
      isHoldingNow(record)
        ? 'loading'
        : 'never finished: the app restarted while holding it',
    )
  }
  return parts.join(' · ')
}

/** Test seam: forget the song this launch is holding. */
export function resetSongPathForTests(): void {
  current = null
}
