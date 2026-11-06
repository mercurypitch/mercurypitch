// ============================================================
// Cast demo song — a song the receiver can sing to itself
// ============================================================
//
// The spike on a Cast device (P6, step 6.0) needs the stage drawing a real
// song before any sender of ours exists. A `demo` message (control.ts)
// plays this one, driven on the receiver: the same `song` and `frame`
// messages a phone sends, so the device draws, wraps and fades exactly what
// it would draw for a phone, and the meter measures that (frame-meter.ts).
//
// Six short lines, a tune that rises and falls through them, and a singer a
// little flat with a vibrato, so the lane shows notes, a trail and a score.
// The song loops: position wraps at its length.
//
// Tests: src/lib/cast-receiver/demo-song.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { TvStageFrame, TvStageNote, TvStageReading, TvStageSong, } from '@/lib/tv-stage/protocol'
import { TV_STAGE_PROTOCOL } from '@/lib/tv-stage/protocol'

export const DEMO_TITLE = 'Cast demo'

/** The demo's length in seconds; it starts again from the top after. */
export const DEMO_SECONDS = 42

/** Seconds between the singer's readings, as the room sends them. */
const READING_STEP = 0.05

const LINES = [
  { at: 2, text: 'Breathe in slow and find the note' },
  { at: 8, text: 'Let it ring across the room' },
  { at: 14, text: 'Every voice can learn to fly' },
  { at: 20, text: 'Hold it steady, hold it true' },
  { at: 26, text: 'Sing it once and sing it twice' },
  { at: 32, text: 'Every lane is drawn for you' },
] as const

/** Seconds a word lasts. */
const WORD_SECONDS = 0.6

/** The tune, a MIDI number for each word in turn. */
const TUNE = [60, 62, 64, 65, 67, 69, 67, 65, 64, 62] as const

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000

interface DemoLine {
  readonly at: number
  readonly words: readonly string[]
  readonly times: readonly (readonly [number, number])[]
}

const DEMO_LINES: readonly DemoLine[] = LINES.map((line) => {
  const words = line.text.split(' ')
  const times = words.map((_, index) => {
    const start = line.at + index * WORD_SECONDS
    return [round(start), round(start + WORD_SECONDS)] as const
  })
  return { at: line.at, words, times }
})

function demoLyrics(): LyricWindowSegment[] {
  const segments: LyricWindowSegment[] = [
    { at: 0, current: [], next: LINES[0].text, words: [] },
  ]
  DEMO_LINES.forEach((line, index) => {
    segments.push({
      at: line.at,
      current: line.words,
      next: index + 1 < LINES.length ? LINES[index + 1].text : null,
      words: line.times,
    })
  })
  return segments
}

function demoNotes(): TvStageNote[] {
  return DEMO_LINES.flatMap((line) =>
    line.times.map(([start], index) => ({
      t0: start,
      t1: round(start + WORD_SECONDS * 0.9),
      midi: TUNE[index % TUNE.length],
    })),
  )
}

const NOTES = demoNotes()

/** The demo song, as a phone would send it. */
export function demoSong(): TvStageSong {
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'song',
    title: DEMO_TITLE,
    duration: DEMO_SECONDS,
    notes: NOTES,
    lyrics: demoLyrics(),
  }
}

/** The singer's pitch at `time`: a note's, a little flat, with a 5.5 Hz vibrato. */
function sung(time: number): number | null {
  const note = NOTES.find(
    (candidate) => candidate.t0 <= time && time < candidate.t1,
  )
  if (note === undefined) return null
  const wobble = 0.25 * Math.sin(2 * Math.PI * 5.5 * time) - 0.1
  return Math.round((note.midi + wobble) * 100) / 100
}

/** Whole reading steps up to `seconds`, past a float's last digit. */
const stepsIn = (seconds: number): number =>
  Math.floor(seconds / READING_STEP + 1e-9)

/** The singer's readings after `from` up to `to`, in seconds of the song. */
function readingsBetween(from: number, to: number): TvStageReading[] {
  const found: TvStageReading[] = []
  for (let step = stepsIn(from) + 1; step <= stepsIn(to); step += 1) {
    const time = round(step * READING_STEP)
    const midi = sung(time)
    if (midi !== null) found.push([time, midi])
  }
  return found
}

/**
 * The demo's frame for `elapsed` seconds since it started, read at `at` on
 * the wall clock, with the singer since `previous` seconds.
 */
export function demoFrame(
  elapsed: number,
  previous: number,
  at: number,
): TvStageFrame {
  const position = round(elapsed % DEMO_SECONDS)
  const since = previous % DEMO_SECONDS
  return {
    v: TV_STAGE_PROTOCOL,
    kind: 'frame',
    at,
    position,
    playing: true,
    rate: 1,
    singer: since <= position ? readingsBetween(since, position) : [],
    score: { pct: 82, grade: 'B' },
  }
}
