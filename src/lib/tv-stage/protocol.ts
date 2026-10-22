// ============================================================
// TV stage protocol — what the room sends a TV that draws its stage
// ============================================================
//
// A TV connected to the phone can show the Karaoke room's stage: the pitch
// lane, the lyrics and the score, in the TV's own landscape while the phone
// stays the room and the microphone (issue #489, the third proof of concept
// for karaoke on a TV). The stage is a page of its own
// (apps/mercurypitch/stage.html) in a web view of its own, with no way into
// the room: everything it draws arrives in these messages, as JSON, through
// the app.
//
// Three kinds. `song` once for each song, and again whenever the stage may
// have missed it: the title, the length, the notes as the room shows them
// (the key shift applied) and the lyrics as the lyrics window gets them
// (lyric-window-script.ts). `frame` about twenty times a second: where the
// song is, read at `at` on the wall clock so the stage can run on between
// frames, the singer's pitch since the last frame, and the score so far.
// `idle` while the room has no song.
//
// Every message carries the protocol's version. A stage drops what it does
// not understand rather than draw it wrong.
//
// Tests: src/lib/tv-stage/protocol.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'

export const TV_STAGE_PROTOCOL = 1

/** A note as the lane draws it: seconds into the song, and its MIDI number. */
export interface TvStageNote {
  readonly t0: number
  readonly t1: number
  readonly midi: number
}

/** One reading of the singer's pitch: seconds into the song, and MIDI. */
export type TvStageReading = readonly [number, number]

export interface TvStageSong {
  readonly v: typeof TV_STAGE_PROTOCOL
  readonly kind: 'song'
  readonly title: string
  /** The song's length in seconds, 0 while it is not known. */
  readonly duration: number
  readonly notes: readonly TvStageNote[]
  readonly lyrics: readonly LyricWindowSegment[]
}

/** The score so far: the share of judged moments in tune, and its grade. */
export interface TvStageScore {
  readonly pct: number
  readonly grade: string
}

export interface TvStageFrame {
  readonly v: typeof TV_STAGE_PROTOCOL
  readonly kind: 'frame'
  /** When `position` was read, in ms on the wall clock (`Date.now()`). */
  readonly at: number
  /** Seconds into the song. */
  readonly position: number
  readonly playing: boolean
  /** How fast the song plays: 1 is as written. */
  readonly rate: number
  /** The singer's pitch since the last frame, oldest first. */
  readonly singer: readonly TvStageReading[]
  readonly score: TvStageScore | null
}

export interface TvStageIdle {
  readonly v: typeof TV_STAGE_PROTOCOL
  readonly kind: 'idle'
}

export type TvStageMessage = TvStageSong | TvStageFrame | TvStageIdle

/** What the room sends while it has no song. */
export const TV_STAGE_IDLE: TvStageIdle = { v: TV_STAGE_PROTOCOL, kind: 'idle' }

type Fields = Record<string, unknown>

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isPair = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  isNumber(value[0]) &&
  isNumber(value[1])

const isNote = (value: unknown): boolean =>
  isFields(value) &&
  isNumber(value.t0) &&
  isNumber(value.t1) &&
  isNumber(value.midi)

const isSegment = (value: unknown): boolean =>
  isFields(value) &&
  isNumber(value.at) &&
  Array.isArray(value.current) &&
  value.current.every((word) => typeof word === 'string') &&
  (value.next === null || typeof value.next === 'string') &&
  Array.isArray(value.words) &&
  value.words.every(isPair)

function isSong(message: Fields): boolean {
  return (
    typeof message.title === 'string' &&
    isNumber(message.duration) &&
    Array.isArray(message.notes) &&
    message.notes.every(isNote) &&
    Array.isArray(message.lyrics) &&
    message.lyrics.every(isSegment)
  )
}

function isScore(value: unknown): boolean {
  return (
    value === null ||
    (isFields(value) && isNumber(value.pct) && typeof value.grade === 'string')
  )
}

function isFrame(message: Fields): boolean {
  return (
    isNumber(message.at) &&
    isNumber(message.position) &&
    typeof message.playing === 'boolean' &&
    isNumber(message.rate) &&
    Array.isArray(message.singer) &&
    message.singer.every(isPair) &&
    isScore(message.score)
  )
}

function hasShape(message: Fields): boolean {
  switch (message.kind) {
    case 'song':
      return isSong(message)
    case 'frame':
      return isFrame(message)
    case 'idle':
      return true
    default:
      return false
  }
}

/**
 * A message read from its JSON, or null for anything else: not JSON,
 * another version, or a shape this stage does not know.
 */
export function readTvStageMessage(json: string): TvStageMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!isFields(parsed) || parsed.v !== TV_STAGE_PROTOCOL) return null
  return hasShape(parsed) ? (parsed as unknown as TvStageMessage) : null
}
