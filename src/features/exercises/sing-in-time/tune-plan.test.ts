import { describe, expect, it } from 'vitest'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import { clefForRange } from '../note-reading/NoteReadingExercise'
import { midiOf } from '../note-reading/staff-kit'
import { seeded } from './take-frames.fixture'
import type { Tune } from './tune-plan'
import { BAR_BEATS, beatSeconds, gridOf, IN_TIME_LEVELS, KEYS, keysFor, levelFor, levelWords, noteAt, planDegrees, planRhythm, planRun, planTune, TUNE_BEATS, TUNES_PER_RUN, writtenDoStep, } from './tune-plan'

const VOICES: readonly VocalRangePreset[] = [
  'soprano',
  'mezzo-soprano',
  'alto',
  'tenor',
  'baritone',
  'bass',
]
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919)

const tunesAt = (level: number, voice: VocalRangePreset = 'alto'): Tune[] =>
  SEEDS.map((seed) =>
    planTune({
      level,
      clef: clefForRange(voice),
      voice,
      random: seeded(seed),
    }),
  )

describe('the levels', () => {
  it('are ten, rounded and held inside', () => {
    expect(IN_TIME_LEVELS).toHaveLength(10)
    expect(levelFor(0)).toBe(IN_TIME_LEVELS[0])
    expect(levelFor(4.6)).toBe(IN_TIME_LEVELS[4])
    expect(levelFor(99)).toBe(IN_TIME_LEVELS[9])
  })

  it("put Lesson 18's two bars at level 5: quarters and halves, steps and thirds, at 60", () => {
    const lv = levelFor(5)
    expect(lv.bpm).toBe(60)
    expect(lv.values).toEqual(['quarter', 'half'])
    expect(lv.leap).toBe(2)
    expect(levelWords(lv)).toBe('quarters and halves, steps and thirds')
  })

  it('start on quarters by step, slow, and end on eighths and wide leaps, faster', () => {
    expect(levelWords(levelFor(1))).toBe('quarters, steps')
    expect(levelFor(1).bpm).toBeLessThan(60)
    expect(levelWords(levelFor(7))).toBe(
      'quarters, halves and eighths, leaps up to a fourth',
    )
    expect(levelWords(levelFor(10))).toBe(
      'quarters, halves and eighths, leaps up to an octave',
    )
  })

  it('never get slower, narrower or fewer keyed as they rise', () => {
    for (let i = 1; i < IN_TIME_LEVELS.length; i++) {
      const [a, b] = [IN_TIME_LEVELS[i - 1], IN_TIME_LEVELS[i]]
      expect(b.bpm).toBeGreaterThanOrEqual(a.bpm)
      expect(b.leap).toBeGreaterThanOrEqual(a.leap)
      expect(b.signs).toBeGreaterThanOrEqual(a.signs)
      expect(b.values.length).toBeGreaterThanOrEqual(a.values.length)
    }
  })

  it('read keys of no more signs than they allow', () => {
    expect(keysFor(levelFor(1)).map((k) => k.name)).toEqual(['C', 'G', 'F'])
    expect(keysFor(levelFor(10))).toEqual(KEYS)
  })
})

describe('a rhythm', () => {
  it('fills two bars of 4/4 at every level, each bar whole', () => {
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const r = planRhythm(levelFor(level), seeded(seed))
        expect(r.reduce((a, b) => a + b, 0)).toBe(TUNE_BEATS)
        // no note crosses the bar line
        let at = 0
        for (const beats of r) {
          const bar = Math.floor(at / BAR_BEATS)
          expect(Math.floor((at + beats - 1e-9) / BAR_BEATS)).toBe(bar)
          at += beats
        }
      }
  })

  it('writes only the values its level reads, and quarters alone to a held do', () => {
    for (const seed of SEEDS) {
      expect(planRhythm(levelFor(2), seeded(seed))).toEqual([
        1, 1, 1, 1, 1, 1, 2,
      ])
      expect(
        planRhythm(levelFor(5), seeded(seed)).every((b) => b === 1 || b === 2),
      ).toBe(true)
    }
  })

  it('ends on a held note at every level', () => {
    for (const level of LEVELS)
      for (const seed of SEEDS)
        expect(planRhythm(levelFor(level), seeded(seed)).at(-1)).toBe(2)
  })

  it('has an odd count of notes where its level moves by step alone, so the line comes home to do', () => {
    for (const level of [1, 2, 3, 4])
      for (const seed of SEEDS)
        expect(planRhythm(levelFor(level), seeded(seed)).length % 2).toBe(1)
  })

  it('carries an eighth pair, on its beat, in every tune once eighths are in play', () => {
    for (const level of [7, 8, 9, 10])
      for (const seed of SEEDS) {
        const r = planRhythm(levelFor(level), seeded(seed))
        expect(r).toContain(0.5)
        let at = 0
        for (let i = 0; i < r.length; i++) {
          if (r[i] === 0.5 && at % 1 === 0) expect(r[i + 1]).toBe(0.5)
          at += r[i]
        }
      }
  })
})

describe('a walk', () => {
  it("stays in its level's notes and moves, never repeats a note, and ends re-do or ti-do", () => {
    for (const level of LEVELS) {
      const lv = levelFor(level)
      for (const seed of SEEDS) {
        const random = seeded(seed)
        const n = planRhythm(lv, random).length
        const d = planDegrees(n, lv, random)
        expect(d).toHaveLength(n)
        expect(lv.starts).toContain(d[0])
        expect(d.at(-1)).toBe(0)
        expect(Math.abs(d.at(-2) ?? 9)).toBe(1)
        for (let i = 1; i < d.length; i++) {
          const move = Math.abs(d[i] - d[i - 1])
          expect(move).toBeGreaterThan(0)
          expect(move).toBeLessThanOrEqual(lv.leap)
        }
        expect(Math.min(...d)).toBeGreaterThanOrEqual(lv.lowest)
        expect(Math.max(...d)).toBeLessThanOrEqual(lv.highest)
        expect(Math.max(...d) - Math.min(...d)).toBeLessThanOrEqual(9)
      }
    }
  })

  it('turns back by a step after a leap of a fourth or more', () => {
    for (const level of [7, 8, 9, 10])
      for (const seed of SEEDS) {
        const d = planDegrees(7, levelFor(level), seeded(seed))
        for (let i = 2; i < d.length; i++) {
          const leap = d[i - 1] - d[i - 2]
          if (Math.abs(leap) < 3) continue
          const back = d[i] - d[i - 1]
          expect(Math.abs(back)).toBe(1)
          expect(Math.sign(back)).toBe(-Math.sign(leap))
        }
      }
  })

  it('shows a third once thirds are in play', () => {
    for (const seed of SEEDS) {
      const d = planDegrees(6, levelFor(5), seeded(seed))
      const widest = Math.max(...d.slice(1).map((x, i) => Math.abs(x - d[i])))
      expect(widest).toBeGreaterThanOrEqual(2)
    }
  })

  it('falls back to a line every level can sing when no walk is found', () => {
    // always the last choice: up by step to so, where no way home is left
    expect(planDegrees(7, levelFor(1), () => 0.9999)).toEqual([
      0, 1, 2, 3, 2, 1, 0,
    ])
  })
})

describe('a tune', () => {
  it('is repeatable from its seed', () => {
    const a = planTune({
      level: 6,
      clef: 'treble',
      voice: 'soprano',
      random: seeded(7),
    })
    const b = planTune({
      level: 6,
      clef: 'treble',
      voice: 'soprano',
      random: seeded(7),
    })
    expect(a).toEqual(b)
  })

  it('lays its notes end to end over the two bars, at its level’s tempo', () => {
    for (const level of LEVELS)
      for (const tune of tunesAt(level)) {
        expect(tune.bpm).toBe(levelFor(level).bpm)
        let at = 0
        for (const n of tune.notes) {
          expect(n.beat).toBe(at)
          at += n.beats
        }
        expect(at).toBe(TUNE_BEATS)
      }
  })

  it("is sung in the singer's range, on the written notes' pitch classes, and ends on do", () => {
    for (const voice of VOICES) {
      const { min, max } = getComfortableMidiRange(voice)
      for (const level of [1, 5, 10])
        for (const tune of tunesAt(level, voice)) {
          expect(tune.clef).toBe(clefForRange(voice))
          for (const n of tune.notes) {
            expect(n.midi).toBeGreaterThanOrEqual(min)
            expect(n.midi).toBeLessThanOrEqual(max)
            expect((((n.midi - midiOf(n.written)) % 12) + 12) % 12).toBe(0)
          }
          expect(tune.notes.at(-1)?.syllable).toBe('do')
          expect(tune.notes.at(-1)?.midi).toBe(tune.doMidi)
        }
    }
  })

  it('is written on the staff with no more than two ledger lines either way', () => {
    for (const voice of VOICES)
      for (const level of LEVELS)
        for (const tune of tunesAt(level, voice))
          for (const n of tune.notes) {
            expect(n.place).toBeGreaterThanOrEqual(-4)
            expect(n.place).toBeLessThanOrEqual(12)
          }
  })

  it('spells its notes in its key: B flat in F, F sharp in G', () => {
    const f = KEYS.find((k) => k.name === 'F')
    const g = KEYS.find((k) => k.name === 'G')
    if (f === undefined || g === undefined) throw new Error('no key')
    for (const seed of SEEDS) {
      const inF = planTune({
        level: 9,
        clef: 'treble',
        voice: 'alto',
        random: seeded(seed),
        key: f,
      })
      for (const n of inF.notes)
        if (n.written.letter === 'B') expect(n.written.alter).toBe(-1)
      const inG = planTune({
        level: 9,
        clef: 'treble',
        voice: 'alto',
        random: seeded(seed),
        key: g,
      })
      for (const n of inG.notes)
        if (n.written.letter === 'F') expect(n.written.alter).toBe(1)
    }
  })

  it('writes do in the octave nearest the middle of the staff', () => {
    const c = KEYS[0]
    // do re mi re do on the treble staff: from C5 it sits a space or two
    // over the middle line; from C4 it would hang under the staff
    expect(writtenDoStep(c, [0, 1, 2, 1, 0], 'treble')).toBe(midiStep('C', 5))
    // and on the bass staff, from C3 it sits on the middle line
    expect(writtenDoStep(c, [0, 1, 2, 1, 0], 'bass')).toBe(midiStep('C', 3))
  })
})

/** The diatonic step of a C or another letter in an octave, as staff-kit counts it. */
function midiStep(letter: 'C', octave: number): number {
  return octave * 7 + 'CDEFGAB'.indexOf(letter)
}

describe('a run', () => {
  it('is three tunes, no two running in one key', () => {
    for (const seed of SEEDS) {
      const run = planRun({
        level: 5,
        clef: 'treble',
        voice: 'soprano',
        random: seeded(seed),
      })
      expect(run).toHaveLength(TUNES_PER_RUN)
      for (let i = 1; i < run.length; i++)
        expect(run[i].key).not.toBe(run[i - 1].key)
    }
  })
})

describe('the beat grid', () => {
  const tune = planTune({
    level: 7,
    clef: 'treble',
    voice: 'alto',
    random: seeded(3),
  })

  it('counts each bar 1 to 4, a held beat in brackets and a split one as eighths', () => {
    const grid = gridOf(tune)
    expect(grid.map((g) => g.count)).toEqual([1, 2, 3, 4, 1, 2, 3, 4])
    for (const [b, g] of grid.entries()) {
      const n = tune.notes[g.note]
      if (g.kind === 'held') expect(n.beat).toBeLessThan(b)
      if (g.kind === 'split') expect(n.beats).toBe(0.5)
      if (g.kind === 'start') expect(n.beat).toBe(b)
    }
    // the last note is a half: its second beat is held
    expect(grid.at(-1)?.kind).toBe('held')
  })

  it('finds the note sounding at a beat, the first before it and the last after', () => {
    expect(noteAt(tune, -1)).toBe(0)
    expect(noteAt(tune, 0)).toBe(0)
    expect(noteAt(tune, TUNE_BEATS + 3)).toBe(tune.notes.length - 1)
    for (const [i, n] of tune.notes.entries()) {
      expect(noteAt(tune, n.beat)).toBe(i)
      expect(noteAt(tune, n.beat + n.beats - 0.01)).toBe(i)
    }
  })

  it('lasts a second a beat at 60', () => {
    expect(beatSeconds({ bpm: 60 })).toBe(1)
    expect(beatSeconds({ bpm: 120 })).toBe(0.5)
  })
})
