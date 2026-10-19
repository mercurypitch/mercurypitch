// ============================================================
// The sung line's score: the Karaoke engine's count, note by note
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { HAIR_CENTS, heardInLine, lineFacts, MAX_LAG_SEC, scoreLine, } from './line-score'
import type { TimedNote } from './sung-line'
import { lineNotes } from './sung-line'

/** The line from C4, its first note 2 s into the window. */
const NOTES = lineNotes(60, 2)

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

interface Voice {
  /** Frames a second. */
  readonly rate?: number
  /** How late the singer is, s. */
  readonly late?: number
  /** Semitones the whole take is shifted by: -12 an octave down. */
  readonly shift?: number
  /** Cents off, by note index; null leaves the note unsung. */
  readonly off?: Readonly<Record<number, number | null>>
}

/** A singer's take of `notes`: the voice on each note, silence between. */
function sing(notes: readonly TimedNote[], voice: Voice = {}): PitchFrame[] {
  const rate = voice.rate ?? 100
  const late = voice.late ?? 0
  const shift = voice.shift ?? 0
  const frames: PitchFrame[] = []
  const end = notes[notes.length - 1].to + 1
  for (let i = 0; i / rate < end; i++) {
    const t = i / rate
    const on = notes.find((note) => t - late >= note.from && t - late < note.to)
    // A note listed as null is left unsung; one not listed is on pitch.
    const listed =
      on !== undefined && voice.off !== undefined && on.index in voice.off
    const off =
      on === undefined ? null : listed ? (voice.off?.[on.index] ?? null) : 0
    frames.push(
      on === undefined || off === null
        ? { t, f0: 0, conf: 0, rms: 0.002 }
        : { t, f0: hz(on.midi + shift + off / 100), conf: 0.95, rms: 0.1 },
    )
  }
  return frames
}

describe('scoreLine', () => {
  it('hears all ten from a singer on every note', () => {
    const score = scoreLine(sing(NOTES), NOTES)
    expect(score).toMatchObject({ hit: 10, total: 10 })
    expect(score.notes.every((note) => note.hit)).toBe(true)
  })

  it('hears all ten an octave down: the Karaoke engine folds octaves', () => {
    expect(scoreLine(sing(NOTES, { shift: -12 }), NOTES).hit).toBe(10)
  })

  it('takes a late answer at its own lag', () => {
    const score = scoreLine(sing(NOTES, { late: 0.25 }), NOTES)
    expect(score.hit).toBe(10)
    // Any lag that lines the voice up with the judged part of each note
    // reads the same: the engine waits 130 ms into every note.
    expect(score.lag).toBeGreaterThan(0.1)
    expect(score.lag).toBeLessThanOrEqual(0.25 + 1e-9)
  })

  it('hears as many on a screen that draws twenty frames a second', () => {
    expect(scoreLine(sing(NOTES, { rate: 20 }), NOTES).hit).toBe(10)
  })

  it('misses notes a semitone off, and only those', () => {
    const score = scoreLine(
      sing(NOTES, { off: { 7: -100, 8: -100, 9: -100 } }),
      NOTES,
    )
    expect(score.hit).toBe(7)
    expect(score.notes.map((note) => note.hit)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
    ])
    expect(score.notes[8].cents).toBeCloseTo(-100, 0)
  })

  it('counts a note unsung as a miss with nothing judged', () => {
    const score = scoreLine(sing(NOTES, { off: { 0: null } }), NOTES)
    expect(score.hit).toBe(9)
    expect(score.notes[0]).toEqual({ hit: false, judged: 0, cents: null })
  })

  it("agrees, note by note, with the engine's own count", () => {
    const takes: Readonly<Record<number, number | null>>[] = [
      {},
      { 1: -70, 4: 90 },
      { 0: null, 3: -300, 9: 45 },
      { 2: 60, 5: null, 6: -55, 8: -20 },
    ]
    for (const off of takes) {
      const score = scoreLine(sing(NOTES, { off, late: 0.1 }), NOTES)
      expect(score.notes.filter((note) => note.hit)).toHaveLength(score.hit)
    }
  })

  it('takes no answer later than MAX_LAG_SEC', () => {
    const score = scoreLine(sing(NOTES, { late: MAX_LAG_SEC + 0.4 }), NOTES)
    expect(score.lag).toBeLessThanOrEqual(MAX_LAG_SEC)
    expect(score.hit).toBeLessThan(10)
  })
})

describe('heardInLine', () => {
  it('hears a voice in the singer turn, and nothing in silence', () => {
    expect(heardInLine(sing(NOTES), NOTES)).toBe(true)
    const silent = sing(NOTES, {
      off: Object.fromEntries(NOTES.map((note) => [note.index, null])),
    })
    expect(heardInLine(silent, NOTES)).toBe(false)
  })

  it('does not count a voice before the line, over the call', () => {
    const early: PitchFrame[] = [
      { t: 0.5, f0: 262, conf: 0.95, rms: 0.1 },
      { t: 1, f0: 262, conf: 0.95, rms: 0.1 },
    ]
    expect(heardInLine(early, NOTES)).toBe(false)
  })
})

describe('lineFacts', () => {
  const facts = (voice: Voice) =>
    lineFacts(scoreLine(sing(NOTES, voice), NOTES))

  it('has no trend when every note was hit', () => {
    expect(facts({})).toMatchObject({ hit: 10, trend: null })
  })

  it('reads misses sung under the note as flat, by a hair within a semitone', () => {
    expect(facts({ off: { 8: -80, 9: -90 } })).toMatchObject({
      hit: 8,
      trend: 'flat',
      slight: true,
    })
    expect(facts({ off: { 8: -250 } })).toMatchObject({
      trend: 'flat',
      slight: false,
    })
  })

  it('reads misses sung over the note as sharp', () => {
    expect(facts({ off: { 2: 80 } })).toMatchObject({
      trend: 'sharp',
      slight: true,
    })
  })

  it('reads notes not sung as unsung, and any mix as a mix', () => {
    expect(facts({ off: { 0: null, 9: null } }).trend).toBe('unsung')
    expect(facts({ off: { 0: null, 9: -80 } }).trend).toBe('mixed')
    expect(facts({ off: { 1: 80, 9: -80 } }).trend).toBe('mixed')
  })

  it('names the high notes only when both went flat', () => {
    expect(facts({ off: { 3: -120, 4: -120, 7: -120 } })).toMatchObject({
      trend: 'flat',
      highFlat: true,
    })
    expect(facts({ off: { 3: -120, 7: -120 } }).highFlat).toBe(false)
    expect(facts({ off: { 3: 120, 4: 120 } }).highFlat).toBe(false)
  })

  it('keeps "a hair" to a semitone', () => {
    expect(HAIR_CENTS).toBe(100)
  })
})
