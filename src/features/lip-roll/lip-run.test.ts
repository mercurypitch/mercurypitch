// ============================================================
// A Lip roll run: its plan, Merc's lines, its result, what is kept
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import type { WaveHeard } from './lip-run'

const kept = vi.hoisted(() => ({
  history: [] as unknown[],
  notes: [] as number[],
  bests: [] as { level: string; run: unknown }[],
  improved: false,
  previous: null as { lit: number } | null,
}))

vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => kept.history.push(entry),
}))

vi.mock('@/stores/lip-roll-store', () => ({
  rememberLipNote: (midi: number) => kept.notes.push(midi),
  lipBest: () => kept.previous,
  recordLipBest: (level: string, run: unknown) => {
    kept.bests.push({ level, run })
    return { improved: kept.improved, previous: kept.previous }
  },
}))

const {
  BREATH_TONE_SEC,
  bestText,
  breaksText,
  introLine,
  jumpsText,
  keepLipRun,
  planLipRun,
  resultChips,
  resultLine,
  summarize,
  topsText,
  waveLine,
} = await import('./lip-run')

const singer = LIP_ROLL_LEVELS.singer
const pro = LIP_ROLL_LEVELS.professional

beforeEach(() => {
  kept.history = []
  kept.notes = []
  kept.bests = []
  kept.improved = false
  kept.previous = null
})

const heard = (over: Partial<WaveHeard> = {}): WaveHeard => ({
  wave: 1,
  coverage: 0.9,
  lit: true,
  voiced: true,
  jumpNote: null,
  breakNote: null,
  topCents: null,
  topReached: null,
  lagSec: 0,
  ...over,
})

const result = (over: Partial<GlideResult> = {}): GlideResult => ({
  litShare: 0.88,
  arches: [0.9, 0.86, 0.88].map((coverage) => ({
    coverage,
    lit: coverage >= 0.75,
    topReached: null,
    topCents: null,
  })),
  archesLit: 3,
  jumps: [],
  breaks: [],
  flipNote: null,
  meanLagMs: 40,
  topsReached: null,
  topTendencyCents: null,
  ...over,
})

describe('the pacing between waves (owner, 15 Oct 2026)', () => {
  // Seconds from a wave's landing to the next wave: a pause, the next
  // root's tone where the level plays one, then the rest of the breath;
  // and the whole run with its count-in.
  it.each([
    [
      'learning',
      { pause: 1.0, tone: 0.7, afterTone: 1.1, rest: 2.8, run: 25.2 },
    ],
    ['singer', { pause: 1.0, tone: 0.7, afterTone: 0.8, rest: 2.5, run: 21.3 }],
    [
      'professional',
      { pause: 0, tone: 0, afterTone: 1.2, rest: 1.2, run: 15.4 },
    ],
  ] as const)(
    '%s: stops, waits, plays the next root, then rolls on',
    (level, want) => {
      const preset = LIP_ROLL_LEVELS[level]
      const plan = planLipRun(
        { roots: [48, 50, 52], semitones: 12, source: 'settled' },
        preset,
      )
      const { arches } = plan.path
      for (let k = 0; k + 1 < arches.length; k++) {
        expect(arches[k + 1].start - arches[k].landingEnd).toBeCloseTo(
          want.rest,
          9,
        )
      }
      expect(preset.pauseSec).toBe(want.pause)
      expect(preset.playsNextRoot ? BREATH_TONE_SEC : 0).toBe(want.tone)
      expect(want.rest - want.pause - want.tone).toBeCloseTo(want.afterTone, 9)
      // From the tone to the next wave: the breath, as it was before.
      expect(want.tone + want.afterTone).toBeCloseTo(preset.breathSec, 9)
      expect(plan.countIn + plan.path.duration).toBeCloseTo(want.run, 9)
    },
  )
})

describe('the plan', () => {
  it("counts in with the root's tone and a breath, then three waves up an octave at the level's timing", () => {
    const plan = planLipRun(
      { roots: [48, 50, 52], semitones: 12, source: 'settled' },
      singer,
    )

    expect(plan.countIn).toBeCloseTo(1 + singer.breathSec, 9)
    expect(plan.path.arches).toHaveLength(3)
    expect(plan.path.arches[0].start).toBe(0)
    expect(plan.path.arches[0].topMidi).toBe(60)
    expect(plan.path.arches[2].rootMidi).toBe(52)
    const first = plan.path.arches[0]
    expect(first.end - first.start).toBeCloseTo(
      singer.upSec + singer.topSec + singer.downSec,
      9,
    )
  })

  it('opens on the wave to its top, or on an easy note when it has no root', () => {
    const plan = planLipRun(
      { roots: [48, 50, 52], semitones: 12, source: 'voiceprint' },
      singer,
    )
    expect(introLine(plan)).toEqual({ moment: 'intro', fields: { top: 'C4' } })
    expect(introLine(null).moment).toBe('introAny')
  })

  it("opens on Merc's cue in the Warm-up, and still asks for an easy note with no root", () => {
    const plan = planLipRun(
      { roots: [48, 50, 52], semitones: 12, source: 'settled' },
      singer,
    )
    expect(introLine(plan, true)).toEqual({ moment: 'routine', fields: {} })
    expect(introLine(null, true).moment).toBe('introAny')
  })
})

describe("Merc's line after a wave", () => {
  it.each([
    [
      'silence, with a tip for the lips',
      heard({ voiced: false, lit: false, coverage: 0 }),
      'tip',
    ],
    [
      'a jump before anything else',
      heard({ jumpNote: 55.2, breakNote: 56 }),
      'jump',
    ],
    ['a break', heard({ breakNote: 57 }), 'break'],
    ['late', heard({ lagSec: 0.2 }), 'behind'],
    ['early', heard({ lagSec: -0.1 }), 'ahead'],
    ['clean', heard({ coverage: 0.97 }), 'waveClean'],
    ['lit', heard({ coverage: 0.85 }), 'onPath'],
    ['short of the dots', heard({ lit: false, coverage: 0.4 }), 'breath'],
  ] as const)('speaks to %s', (_, wave, moment) => {
    expect(waveLine(wave, singer, 50, 60).moment).toBe(moment)
  })

  it('names where the sound stopped, and the next root in a breath', () => {
    expect(waveLine(heard({ breakNote: 55.4 }), singer, 50, 60)).toEqual({
      moment: 'break',
      fields: { note: 'G3' },
    })
    expect(
      waveLine(heard({ lit: false, coverage: 0.3 }), singer, 50, 60).fields,
    ).toEqual({ note: 'D3' })
  })

  it('speaks to the top at Pro, short or past, when it was missed', () => {
    const short = heard({ topReached: false, topCents: -45 })
    const past = heard({ topReached: false, topCents: 50 })
    expect(waveLine(short, pro, 50, 60)).toEqual({
      moment: 'shortTop',
      fields: { top: 'C4' },
    })
    expect(waveLine(past, pro, 50, 60).moment).toBe('pastTop')
    expect(
      waveLine(heard({ topReached: true, topCents: -10 }), pro, 50, 60).moment,
    ).toBe('onPath')
  })
})

describe('the result', () => {
  it('sums the run as its screen shows it: the share lit, one chip for the breaks', () => {
    const summary = summarize(
      result(),
      { improved: false, previousBest: 80 },
      'Singer',
    )

    expect(summary.litPct).toBe(88)
    expect(summary.wavesLit).toBe(3)
    expect(breaksText(summary)).toBe('No breaks')
    expect(jumpsText(summary)).toBeNull()
    expect(topsText(summary)).toBeNull()
    expect(resultChips(summary)).toEqual(['No breaks'])
    expect(bestText(summary)).toBe('Best 88%')
  })

  it('names the breaks and the jumps near their notes, the tops at Pro, and "New best"', () => {
    const summary = summarize(
      result({
        topsReached: 2,
        breaks: [
          { note: 55, arch: 0, t: 2 },
          { note: 55, arch: 2, t: 12 },
        ],
        jumps: [{ note: 64, arch: 1, t: 7 }],
      }),
      { improved: true, previousBest: 70 },
      'Professional',
    )
    expect(resultChips(summary)).toEqual([
      '2 breaks near G3',
      '1 jump near E4',
      'Tops 2 of 3',
    ])
    expect(bestText(summary)).toBe('New best')
  })

  it.each([
    ['three clean waves first', result(), false, 'resultClean'],
    ['a new best next', result({ archesLit: 2 }), true, 'newBest'],
    [
      'the note it flips at',
      result({
        archesLit: 2,
        flipNote: 64,
        jumps: [
          { note: 64, arch: 0, t: 2 },
          { note: 64, arch: 2, t: 12 },
        ],
      }),
      false,
      'resultFlip',
    ],
    [
      'an oo for lips that kept stopping',
      result({
        breaks: [
          { note: 55, arch: 0, t: 2 },
          { note: 57, arch: 1, t: 7 },
          { note: 55, arch: 2, t: 12 },
        ],
      }),
      false,
      'tipOo',
    ],
    [
      'where the sound stops',
      result({ breaks: [{ note: 57, arch: 1, t: 7 }] }),
      false,
      'resultBreaks',
    ],
    ['the share otherwise', result({ archesLit: 2 }), false, 'result'],
  ] as const)('leads with %s', (_, run, improved, moment) => {
    const summary = summarize(run, { improved, previousBest: null }, 'Singer')
    expect(resultLine(run, summary, singer).moment).toBe(moment)
  })

  it('says the tops fell short at Pro', () => {
    const run = result({ archesLit: 2, topTendencyCents: -60 })
    const summary = summarize(
      run,
      { improved: false, previousBest: null },
      'Professional',
    )
    expect(resultLine(run, summary, pro).moment).toBe('resultShort')
  })
})

describe('keeping a run', () => {
  it('records the history, the best at its level and the note it settled on', () => {
    kept.improved = true
    kept.previous = { lit: 70 }

    const outcome = keepLipRun(
      'singer',
      result({ breaks: [{ note: 57, arch: 1, t: 7 }] }),
      51.6,
      1_000,
    )

    expect(outcome).toEqual({ improved: true, previousBest: 70 })
    expect(kept.history).toEqual([
      {
        type: 'lip-roll-bay',
        score: 88,
        metrics: { lit: 88, wavesLit: 3, jumps: 0, breaks: 1, lagMs: 40 },
        completedAt: 1_000,
      },
    ])
    expect(kept.notes).toEqual([52])
    expect(kept.bests).toEqual([
      { level: 'singer', run: { lit: 88, arches: 3, jumps: 0, at: 1_000 } },
    ])
  })

  it('keeps a run that lit nothing in the history only', () => {
    const outcome = keepLipRun(
      'learning',
      result({ litShare: 0, archesLit: 0 }),
      null,
      5,
    )

    expect(outcome).toEqual({ improved: false, previousBest: null })
    expect(kept.history).toHaveLength(1)
    expect(kept.bests).toEqual([])
    expect(kept.notes).toEqual([])
  })
})
