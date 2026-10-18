// ============================================================
// An Ng slides run: its plan, Merc's lines, its result, what is kept
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import type { SlideHeard } from './ng-run'

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

vi.mock('@/stores/ng-slides-store', () => ({
  rememberNgNote: (midi: number) => kept.notes.push(midi),
  ngBest: () => kept.previous,
  recordNgBest: (level: string, run: unknown) => {
    kept.bests.push({ level, run })
    return { improved: kept.improved, previous: kept.previous }
  },
}))

const {
  BREATH_TONE_SEC,
  bestText,
  introLine,
  jumpsText,
  keepNgRun,
  planNgRun,
  resultLine,
  slideLine,
  summarize,
  topsText,
} = await import('./ng-run')

const singer = NG_SLIDES_LEVELS.singer
const pro = NG_SLIDES_LEVELS.professional

beforeEach(() => {
  kept.history = []
  kept.notes = []
  kept.bests = []
  kept.improved = false
  kept.previous = null
})

const heard = (over: Partial<SlideHeard> = {}): SlideHeard => ({
  arch: 1,
  coverage: 0.9,
  lit: true,
  voiced: true,
  jumpNote: null,
  broke: false,
  topCents: null,
  topReached: null,
  lagSec: 0,
  ...over,
})

const result = (over: Partial<GlideResult> = {}): GlideResult => ({
  litShare: 0.84,
  arches: [0.9, 0.85, 0.8, 0.82, 0.83].map((coverage) => ({
    coverage,
    lit: coverage >= 0.8,
    topReached: null,
    topCents: null,
  })),
  archesLit: 5,
  jumps: [],
  breaks: [],
  flipNote: null,
  meanLagMs: 40,
  topsReached: null,
  topTendencyCents: null,
  ...over,
})

describe('the pacing between slides (owner, 15 Oct 2026)', () => {
  // Seconds from a slide's landing to the next slide: a pause, the next
  // root's tone where the level plays one, then the rest of the breath;
  // and the whole run with its count-in.
  it.each([
    [
      'learning',
      { pause: 1.0, tone: 0.7, afterTone: 0.9, rest: 2.6, run: 33.0 },
    ],
    ['singer', { pause: 1.0, tone: 0.7, afterTone: 0.6, rest: 2.3, run: 27.5 }],
    [
      'professional',
      { pause: 0, tone: 0, afterTone: 1.0, rest: 1.0, run: 18.0 },
    ],
  ] as const)(
    '%s: stops, waits, plays the next root, then rolls on',
    (level, want) => {
      const preset = NG_SLIDES_LEVELS[level]
      const plan = planNgRun(
        { roots: [45, 46, 47, 48, 49], semitones: 7, source: 'settled' },
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
      // From the tone to the next slide: the breath, as it was before.
      expect(want.tone + want.afterTone).toBeCloseTo(preset.breathSec, 9)
      expect(plan.countIn + plan.path.duration).toBeCloseTo(want.run, 9)
    },
  )
})

describe('the plan', () => {
  it("counts in with the root's tone and a breath, then five slides at the level's timing", () => {
    const plan = planNgRun(
      { roots: [45, 46, 47, 48, 49], semitones: 7, source: 'settled' },
      singer,
    )

    expect(plan.countIn).toBeCloseTo(1 + singer.breathSec, 9)
    expect(plan.path.arches).toHaveLength(5)
    expect(plan.path.arches[0].start).toBe(0)
    expect(plan.path.arches[0].topMidi).toBe(52)
    const first = plan.path.arches[0]
    expect(first.end - first.start).toBeCloseTo(
      singer.upSec + singer.topSec + singer.downSec,
      9,
    )
  })

  it('opens on the slide to its top, or on an easy note when it has no root', () => {
    const plan = planNgRun(
      { roots: [45, 46, 47, 48, 49], semitones: 7, source: 'voiceprint' },
      singer,
    )
    expect(introLine(plan)).toEqual({ moment: 'intro', fields: { top: 'E3' } })
    expect(introLine(null).moment).toBe('introAny')
  })

  it("opens on Merc's cue in the Warm-up, and still asks for an easy note with no root", () => {
    const plan = planNgRun(
      { roots: [45, 46, 47, 48, 49], semitones: 7, source: 'settled' },
      singer,
    )
    expect(introLine(plan, true)).toEqual({ moment: 'routine', fields: {} })
    expect(introLine(null, true).moment).toBe('introAny')
  })
})

describe("Merc's line after a slide", () => {
  it.each([
    ['silent', heard({ voiced: false, lit: false, coverage: 0 }), 'silent'],
    [
      'a jump before anything else',
      heard({ jumpNote: 49.2, broke: true }),
      'jump',
    ],
    ['a break', heard({ broke: true }), 'break'],
    ['late', heard({ lagSec: 0.15 }), 'behind'],
    ['early', heard({ lagSec: -0.05 }), 'ahead'],
    ['clean', heard({ coverage: 0.97 }), 'archClean'],
    ['lit', heard({ coverage: 0.85 }), 'onPath'],
    ['short of the line', heard({ lit: false, coverage: 0.4 }), 'breath'],
  ] as const)('speaks to %s', (_, slide, moment) => {
    expect(slideLine(slide, singer, 47, 53).moment).toBe(moment)
  })

  it('names the note it jumped near, and the next root in a breath', () => {
    expect(slideLine(heard({ jumpNote: 49.2 }), singer, 47, 53)).toEqual({
      moment: 'jump',
      fields: { note: 'C#3' },
    })
    expect(
      slideLine(heard({ lit: false, coverage: 0.3 }), singer, 47, 53).fields,
    ).toEqual({ note: 'B2' })
  })

  it('speaks to the top at Pro, flat or sharp, when it was missed', () => {
    const flat = heard({ topReached: false, topCents: -45 })
    const sharp = heard({ topReached: false, topCents: 40 })
    expect(slideLine(flat, pro, 47, 53)).toEqual({
      moment: 'topFlat',
      fields: { top: 'F3' },
    })
    expect(slideLine(sharp, pro, 47, 53).moment).toBe('topSharp')
    expect(
      slideLine(heard({ topReached: true, topCents: -10 }), pro, 47, 53).moment,
    ).toBe('onPath')
  })
})

describe('the result', () => {
  it('sums the run as its screen shows it', () => {
    const summary = summarize(
      result({ jumps: [{ note: 52, arch: 1, t: 4 }], flipNote: null }),
      { improved: false, previousBest: 80 },
      'Singer',
    )

    expect(summary.litPct).toBe(84)
    expect(summary.archesLit).toBe(5)
    expect(jumpsText(summary)).toBe('1 jump near E3')
    expect(topsText(summary)).toBeNull()
    expect(bestText(summary)).toBe('Best 84%')
  })

  it('says "No jumps", the tops at Pro, and "New best"', () => {
    const summary = summarize(
      result({ topsReached: 4 }),
      { improved: true, previousBest: 70 },
      'Professional',
    )
    expect(jumpsText(summary)).toBe('No jumps')
    expect(topsText(summary)).toBe('Tops 4 of 5')
    expect(bestText(summary)).toBe('New best')
  })

  it.each([
    ['five clean slides first', result(), false, 'resultClean'],
    ['a new best next', result({ archesLit: 4 }), true, 'newBest'],
    [
      'the note it flips at',
      result({
        archesLit: 4,
        flipNote: 52,
        jumps: [
          { note: 52, arch: 1, t: 4 },
          { note: 52, arch: 3, t: 14 },
        ],
      }),
      false,
      'resultFlip',
    ],
    [
      'a late run',
      result({ archesLit: 4, meanLagMs: 120 }),
      false,
      'resultLate',
    ],
    ['the share otherwise', result({ archesLit: 4 }), false, 'result'],
  ] as const)('leads with %s', (_, run, improved, moment) => {
    const summary = summarize(run, { improved, previousBest: null }, 'Singer')
    expect(resultLine(run, summary, singer).moment).toBe(moment)
  })

  it('says the tops sat flat at Pro', () => {
    const run = result({ archesLit: 3, topTendencyCents: -40, meanLagMs: 10 })
    const summary = summarize(
      run,
      { improved: false, previousBest: null },
      'Professional',
    )
    expect(resultLine(run, summary, pro).moment).toBe('resultTopsFlat')
  })
})

describe('keeping a run', () => {
  it('records the history, the best at its level and the note it settled on', () => {
    kept.improved = true
    kept.previous = { lit: 70 }

    const outcome = keepNgRun(
      'singer',
      result({ jumps: [{ note: 52, arch: 1, t: 4 }] }),
      49.6,
      1_000,
    )

    expect(outcome).toEqual({ improved: true, previousBest: 70 })
    expect(kept.history).toEqual([
      {
        type: 'ng-slides-bridge',
        score: 84,
        metrics: { lit: 84, archesLit: 5, jumps: 1, breaks: 0, lagMs: 40 },
        completedAt: 1_000,
      },
    ])
    expect(kept.notes).toEqual([50])
    expect(kept.bests).toEqual([
      { level: 'singer', run: { lit: 84, arches: 5, jumps: 1, at: 1_000 } },
    ])
  })

  it('keeps a run that lit nothing in the history only', () => {
    const outcome = keepNgRun(
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
