// ============================================================
// A First note turn's ears: the entry, the voice and the round decided
// ============================================================

import { describe, expect, it } from 'vitest'
import { FRAME_SECONDS, silentFrame, voicedFrame, } from '@/components/demo-kit/demo-voice'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { EntryHeard, RoundOutcome } from './first-note-machine'
import { FIRST_NOTE_LEVELS } from './first-note-rules'
import type { FirstNoteRound } from './first-note-songs'
import { FIRST_NOTE_SONGS } from './first-note-songs'
import { createFirstTurn } from './first-note-turn'

const SONG = FIRST_NOTE_SONGS[0]
const ROUND: FirstNoteRound = {
  index: 0,
  song: SONG,
  entry: SONG.entries[0],
  lineShare: 0.4,
}
const NOTE = ROUND.entry.midi + (ROUND.entry.cents ?? 0) / 100
const SINGER = FIRST_NOTE_LEVELS.singer

/** `seconds` of frames from `from`, sung `cents` off the note, or silent. */
function frames(from: number, seconds: number, cents: number | null) {
  const out: PitchFrame[] = []
  for (let t = from; t < from + seconds; t += FRAME_SECONDS) {
    out.push(cents === null ? silentFrame(t) : voicedFrame(t, NOTE, cents, 0.8))
  }
  return out
}

/**
 * A turn on a room that records what it was told. The singer's turn ends
 * as the round is decided, as the room's does; or it is never on.
 */
function turnOn(inTurn = true) {
  const told = {
    entry: null as EntryHeard | null,
    marks: [] as string[],
    outcomes: [] as RoundOutcome[],
    voices: 0,
    silent: 0,
    inBand: [] as boolean[],
  }
  const turn = createFirstTurn({
    singing: () => inTurn && told.outcomes.length === 0,
    listening: () => told.outcomes.length === 0,
    entry: () => told.entry,
    entered: (entry) => {
      told.entry = entry
      told.marks.push('entry')
    },
    heard: (voice, inBand) => {
      if (voice === null) told.silent += 1
      else told.voices += 1
      told.inBand.push(inBand)
    },
    heardAgain: () => false,
    mark: (moment) => told.marks.push(moment),
    decided: (outcome) => told.outcomes.push(outcome),
  })
  return { turn, told }
}

describe("a First note turn's ears", () => {
  it('hears nothing before it opens, nor before its response starts', () => {
    const { turn, told } = turnOn()
    turn.reset(ROUND, SINGER)
    const early = frames(0, 1, 0)
    turn.follow(early)
    expect(told.voices).toBe(0)
    turn.open(2)
    expect(turn.responseStart()).toBe(2)
    // The same window's frames, longer: those before 2 s never count.
    turn.follow([...early, ...frames(1, 0.9, 0)])
    expect(told.voices).toBe(0)
    expect(turn.points()).toEqual([])
  })

  it('takes the entry on the note, then lands the round on it', () => {
    const { turn, told } = turnOn()
    turn.reset(ROUND, SINGER)
    turn.open(0)
    turn.follow(frames(0, 2, 3))
    expect(told.entry?.onNote).toBe(true)
    expect(told.marks).toEqual(['entry', 'land:0'])
    expect(told.outcomes).toHaveLength(1)
    expect(told.outcomes[0]).toMatchObject({
      round: ROUND,
      landed: true,
      voiced: true,
      heardAgain: false,
    })
    expect(told.outcomes[0].seconds).toBeGreaterThanOrEqual(0)
    expect(told.inBand.at(-1)).toBe(true)
    expect(turn.points().length).toBeGreaterThan(0)
  })

  it('takes an entry a step low, and misses once the silence after it ends the turn', () => {
    const { turn, told } = turnOn()
    turn.reset(ROUND, SINGER)
    turn.open(0)
    const sung = frames(0, 1.5, -200)
    turn.follow(sung)
    expect(told.entry?.onNote).toBe(false)
    expect(told.entry?.cents).toBeLessThan(-150)
    expect(told.outcomes).toEqual([])
    const quiet = SINGER.timing.mode === 'free' ? SINGER.timing.endSilenceMs : 0
    turn.follow([...sung, ...frames(1.5, quiet / 1000 + 0.2, null)])
    expect(told.marks).toEqual(['entry', 'miss:0'])
    expect(told.outcomes[0]).toMatchObject({
      landed: false,
      seconds: null,
      voiced: true,
      entry: told.entry,
    })
    expect(told.silent).toBeGreaterThan(0)
  })

  it("hears only in the singer's turn", () => {
    const { turn, told } = turnOn(false)
    turn.reset(ROUND, SINGER)
    turn.open(0)
    turn.follow(frames(0, 2, 0))
    expect(told.voices).toBe(0)
    expect(told.outcomes).toEqual([])
  })

  it('lets everything go on a clear, and hears nothing until the next round', () => {
    const { turn, told } = turnOn()
    turn.reset(ROUND, SINGER)
    turn.open(0)
    turn.follow(frames(0, 0.1, 0))
    expect(turn.points().length).toBeGreaterThan(0)
    turn.clear()
    expect(turn.points()).toEqual([])
    turn.follow(frames(0, 2, 0))
    expect(told.outcomes).toEqual([])
  })
})
