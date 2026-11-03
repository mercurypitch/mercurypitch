// ============================================================
// TV stage feed — the room's state, put into stage messages
// ============================================================
//
// What the Karaoke room hands a TV that draws its stage (protocol.ts),
// built from what the room's mixer already has: the notes it shows, the
// lyrics it lights, and the readings its microphone keeps. The room calls
// these and sends the result (useKaraokeTvStage.ts); nothing here talks to
// a device, so all of it can be tested without one.
//
// The singer's readings are kept as the microphone took them, when the
// sound reached it. The voice was answering the song one round trip
// earlier, the delay the latency calibration measured, so each reading is
// moved back by that much before it goes, and the trail lines up with the
// notes the singer was singing. That is the same correction scoring makes
// (useStemMixerMicController.ts, pushComparison).
//
// EVERY NUMBER IS CHECKED HERE, before it goes. A message crosses as JSON,
// which writes a NaN or an Infinity as null, and the stage drops a message
// with a null where a number belongs, whole and without a word: one bad
// note would cost the TV the song, one bad reading the frame. So:
//
//   - a note, a reading or a lyric line with a number that is not one is
//     dropped, never moved to 0, since a note at 0 is a wrong note; a
//     line's word timings stop at the first bad one, and the words after
//     it stay unlit;
//   - a song's length that is not one goes as 0, which the protocol reads
//     as not known yet; a score as none, which the stage shows as nothing
//     judged yet; a rate as 1, the song as written;
//   - a clock reading (where the song is, and when that was read) has no
//     value for "not known", and 0 is not safe: a position of 0 jumps the
//     lane to the song's start and drops the singer's trail, and an `at` of
//     0 runs the song on by the whole age of the wall clock. So a frame
//     whose reading is not a number carries the last good one again, and
//     the stage runs on as if no clock had come with it; before any, the
//     stage's own start: the song's beginning, standing still.
//
// Tests: src/lib/tv-stage/feed.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { TvStageFrame, TvStageNote, TvStageReading, TvStageScore, TvStageSong, } from './protocol'
import { TV_STAGE_PROTOCOL } from './protocol'

/** A note as the room's pitch analysis has it (midi-generator.ts, MergedNote). */
export interface FeedNote {
  readonly midi: number
  readonly startSec: number
  readonly endSec: number
}

/** A pitch reading as the room's microphone keeps it (stem-mixer/types.ts, PitchNote). */
export interface FeedReading {
  /** Seconds into the song when the sound reached the microphone. */
  readonly time: number
  readonly frequency: number
}

/** A score as the room's mic controller works it out (mic-scoring.ts, MicScore). */
export interface FeedScore {
  readonly totalNotes: number
  readonly accuracyPct: number
  readonly grade: string
}

/** The most readings one frame carries: a frame missed should not flood the next. */
export const FRAME_READINGS_LIMIT = 120

/** Where the song is, and when the room read it: what the stage runs its clock on. */
type FrameClock = Pick<TvStageFrame, 'at' | 'position' | 'playing' | 'rate'>

/** What the stage assumes before any frame: the song's start, standing still. */
const NO_CLOCK: FrameClock = { at: 0, position: 0, playing: false, rate: 1 }

/** Seconds and MIDI numbers to the millisecond and the cent: what crosses as JSON. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000
const round2 = (value: number): number => Math.round(value * 100) / 100

/** A number JSON keeps: not NaN, not either infinity. */
const isNumber = (value: number): boolean => Number.isFinite(value)

const isPair = (pair: readonly [number, number]): boolean =>
  isNumber(pair[0]) && isNumber(pair[1])

/** A frequency in Hz as a MIDI number, with the fraction kept. */
export function midiOfFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

/** A note as it crosses, or null for one with no length or a bad number. */
function noteOf(note: FeedNote): TvStageNote | null {
  if (!(note.endSec > note.startSec)) return null
  const sent = { t0: round3(note.startSec), t1: round3(note.endSec) }
  if (!isNumber(sent.t0) || !isNumber(sent.t1) || !isNumber(note.midi)) {
    return null
  }
  return { ...sent, midi: note.midi }
}

/**
 * The lyrics as the stage can place them: a line with no time of its own is
 * dropped, and a line's word timings stop at the first that is not one.
 */
function lyricsOf(
  lyrics: readonly LyricWindowSegment[],
): readonly LyricWindowSegment[] {
  const kept: LyricWindowSegment[] = []
  for (const segment of lyrics) {
    if (!isNumber(segment.at)) continue
    const bad = segment.words.findIndex((pair) => !isPair(pair))
    kept.push(
      bad < 0 ? segment : { ...segment, words: segment.words.slice(0, bad) },
    )
  }
  return kept
}

/** The song message for the song in the room. */
export function tvStageSong(song: {
  readonly title: string
  readonly duration: number
  readonly notes: readonly FeedNote[]
  readonly lyrics: readonly LyricWindowSegment[]
}): TvStageSong {
  const notes: TvStageNote[] = []
  for (const note of song.notes) {
    const sent = noteOf(note)
    if (sent !== null) notes.push(sent)
  }
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'song',
    title: song.title,
    duration: isNumber(song.duration) ? Math.max(0, song.duration) : 0,
    notes,
    lyrics: lyricsOf(song.lyrics),
  }
}

/** A reading as it crosses, or null for silence or a bad number. */
function readingOf(time: number, frequency: number): TvStageReading | null {
  if (!(frequency > 0)) return null
  const reading: TvStageReading = [
    round3(time),
    round2(midiOfFrequency(frequency)),
  ]
  return isPair(reading) ? reading : null
}

/**
 * The singer's readings after `fromSec`, moved back by `lagSec` (see the
 * header), oldest first and at most `FRAME_READINGS_LIMIT`. `fromSec` is in
 * the moved time, as the last reading sent was, so it stays a number: a
 * round trip that is not one places no reading, and none goes.
 */
export function singerSince(
  history: readonly FeedReading[],
  fromSec: number,
  lagSec: number,
): TvStageReading[] {
  const found: TvStageReading[] = []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const reading = history[index]
    const time = reading.time - lagSec
    if (time <= fromSec || found.length >= FRAME_READINGS_LIMIT) break
    const sent = readingOf(time, reading.frequency)
    if (sent !== null) found.push(sent)
  }
  return found.reverse()
}

/** The score as the stage shows it, or null before anything was judged. */
export function tvStageScore(score: FeedScore | null): TvStageScore | null {
  if (score === null || !(score.totalNotes > 0)) return null
  const pct = Math.round(score.accuracyPct)
  return isNumber(pct) ? { pct, grade: score.grade } : null
}

/** A frame's clock, or null where the song's place or its time is not a number. */
function clockOf(frame: FrameClock): FrameClock | null {
  const at = Math.round(frame.at)
  const position = round3(Math.max(0, frame.position))
  if (!isNumber(at) || !isNumber(frame.position) || !isNumber(position)) {
    return null
  }
  const rate = isNumber(frame.rate) && frame.rate > 0 ? frame.rate : 1
  return { at, position, playing: frame.playing, rate }
}

/**
 * One frame: where the song is, read at `at`, and what the singer did.
 * `previous` is the frame sent before it, whose clock a frame with a bad
 * clock reading carries again (see the header).
 */
export function tvStageFrame(
  frame: FrameClock & {
    readonly singer: readonly TvStageReading[]
    readonly score: TvStageScore | null
  },
  previous: TvStageFrame | null = null,
): TvStageFrame {
  const clock = clockOf(frame) ?? previous ?? NO_CLOCK
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'frame',
    at: clock.at,
    position: clock.position,
    playing: clock.playing,
    rate: clock.rate,
    singer: frame.singer.filter(isPair),
    score:
      frame.score !== null && isNumber(frame.score.pct) ? frame.score : null,
  }
}
