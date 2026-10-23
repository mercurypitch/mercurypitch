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

/** Seconds and MIDI numbers to the millisecond and the cent: what crosses as JSON. */
const round3 = (value: number): number => Math.round(value * 1000) / 1000
const round2 = (value: number): number => Math.round(value * 100) / 100

/** A frequency in Hz as a MIDI number, with the fraction kept. */
export function midiOfFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

/** The song message for the song in the room. */
export function tvStageSong(song: {
  readonly title: string
  readonly duration: number
  readonly notes: readonly FeedNote[]
  readonly lyrics: readonly LyricWindowSegment[]
}): TvStageSong {
  const notes: TvStageNote[] = song.notes
    .filter((note) => note.endSec > note.startSec)
    .map((note) => ({
      t0: round3(note.startSec),
      t1: round3(note.endSec),
      midi: note.midi,
    }))
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'song',
    title: song.title,
    duration: Math.max(0, song.duration),
    notes,
    lyrics: song.lyrics,
  }
}

/**
 * The singer's readings after `fromSec`, moved back by `lagSec` (see the
 * header), oldest first and at most `FRAME_READINGS_LIMIT`. `fromSec` is in
 * the moved time, as the last reading sent was.
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
    if (reading.frequency > 0) {
      found.push([round3(time), round2(midiOfFrequency(reading.frequency))])
    }
  }
  return found.reverse()
}

/** The score as the stage shows it, or null before anything was judged. */
export function tvStageScore(score: FeedScore | null): TvStageScore | null {
  if (score === null || score.totalNotes <= 0) return null
  return { pct: Math.round(score.accuracyPct), grade: score.grade }
}

/** One frame: where the song is, read at `at`, and what the singer did. */
export function tvStageFrame(frame: {
  readonly at: number
  readonly position: number
  readonly playing: boolean
  readonly rate: number
  readonly singer: readonly TvStageReading[]
  readonly score: TvStageScore | null
}): TvStageFrame {
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'frame',
    at: Math.round(frame.at),
    position: round3(Math.max(0, frame.position)),
    playing: frame.playing,
    rate: frame.rate > 0 ? frame.rate : 1,
    singer: frame.singer,
    score: frame.score,
  }
}
