// ============================================================
// Hold engine — lock, breaks, fill and end over synthetic ticks
// ============================================================
//
// Every tick is 1/60 s. Where the smoothed centre decides a crossing, the
// tick count comes from the one-pole step response with alpha =
// 1 - exp(-dt / 0.1) (worked by hand in the comment next to each case).

import { describe, expect, it } from 'vitest'
import { silence } from '@/lib/glass/test-frames'
import type { HoldEventType, HoldPreset, HoldState } from './hold-engine'
import { createHoldState, HOLD_PRESETS, runHold, tickHold } from './hold-engine'
import { computeHoldResult } from './hold-metrics'
import type { TakeShape } from './test-takes'
import { realisticTake, takeCents } from './test-takes'

const DT = 1 / 60
const EXERCISE = HOLD_PRESETS.exercise

interface Logged {
  state: HoldState
  /** [1-based tick number within this call, event] */
  events: Array<[number, HoldEventType]>
  /** charge after every tick */
  charges: number[]
  /** inBand after every tick */
  inBand: boolean[]
}

/** Tick a list of offCents readings (null = unvoiced), one per 1/60 s. */
function play(
  readings: ReadonlyArray<number | null>,
  start: HoldState = createHoldState(),
  preset: HoldPreset = EXERCISE,
): Logged {
  let state = start
  const events: Array<[number, HoldEventType]> = []
  const charges: number[] = []
  const inBand: boolean[] = []
  readings.forEach((offCents, i) => {
    state = tickHold(state, { offCents, level: 0.6, dt: DT }, preset)
    for (const event of state.events) events.push([i + 1, event])
    charges.push(state.charge)
    inBand.push(state.inBand)
  })
  return { state, events, charges, inBand }
}

const constant = (ticks: number, offCents: number | null) =>
  Array.from({ length: ticks }, () => offCents)

const vibrato = (seconds: number, rateHz: number, extentCents: number) =>
  Array.from(
    { length: Math.round(seconds * 60) },
    (_, i) => extentCents * Math.sin(2 * Math.PI * rateHz * ((i + 1) / 60)),
  )

describe('tickHold, exercise preset', () => {
  it('locks a clean hold after exactly 250 ms and dates the lock from the band entry', () => {
    // Arrange
    const readings = constant(300, 0)

    // Act
    const run = play(readings)

    // Assert
    expect(run.events).toEqual([[15, 'lock']])
    expect(run.state.phase).toBe('locked')
    expect(run.state.firstVoicedAt).toBe(0)
    expect(run.state.firstLockAt).toBe(0)
    expect(run.state.inBandSeconds).toBeCloseTo(5, 9)
    expect(run.state.lockSeconds).toBeCloseTo(5, 9)
    expect(run.state.longestLockSeconds).toBeCloseTo(5, 9)
    expect(run.state.charge).toBeCloseTo(5 / 12, 9)
    expect(run.state.breaks).toBe(0)
  })

  it('locks a scoop only once the smoothed centre is in band, 250 ms later', () => {
    // Arrange: 0.3 s at -80 cents, then on the note. The centre starts at
    // -80 and reaches -29.4 (in band) on the 6th tick on the note: tick 24.
    // The band run starts at tick 23's clock (23/60) and locks 15 ticks on.
    const readings = [...constant(18, -80), ...constant(120, 0)]

    // Act
    const run = play(readings)

    // Assert
    expect(run.inBand.indexOf(true) + 1).toBe(24)
    expect(run.events).toEqual([[38, 'lock']])
    expect(run.state.firstVoicedAt).toBe(0)
    expect(run.state.firstLockAt).toBeCloseTo(23 / 60, 9)
  })

  it('stays locked through a 5.5 Hz, +-40 cent vibrato and fills at full rate', () => {
    // Arrange
    const readings = vibrato(6, 5.5, 40)

    // Act
    const run = play(readings)

    // Assert
    expect(run.inBand.every(Boolean)).toBe(true)
    expect(run.events).toEqual([[15, 'lock']])
    expect(run.state.breaks).toBe(0)
    expect(run.state.inBandSeconds).toBeCloseTo(6, 9)
  })

  it('never locks that vibrato when the band is judged on raw readings', () => {
    // Arrange: the reason the centre is smoothed. Raw in-band runs last
    // about 98 ms, never the 250 ms a lock needs.
    const raw: HoldPreset = { ...EXERCISE, centreTauSec: 0 }

    // Act
    const run = play(vibrato(6, 5.5, 40), createHoldState(), raw)

    // Assert
    expect(run.state.firstLockAt).toBeNull()
    expect(run.state.phase).toBe('voiced')
  })

  it('counts a break and a relock for every half-second wander to +60 cents', () => {
    // Arrange: 0 / +60 / 0 / +60 / 0, half a second each. The centre leaves
    // the band on the 5th tick of each +60 half and comes back on the 5th
    // tick of each 0 half, so the in-band ticks are 30 + 4 + 26 + 4 + 26.
    const readings = [
      ...constant(30, 0),
      ...constant(30, 60),
      ...constant(30, 0),
      ...constant(30, 60),
      ...constant(30, 0),
    ]

    // Act
    const run = play(readings)

    // Assert
    expect(run.events.map(([, event]) => event)).toEqual([
      'lock',
      'break',
      'relock',
      'break',
      'relock',
    ])
    expect(run.state.breaks).toBe(2)
    expect(run.state.inBandSeconds).toBeCloseTo(90 / 60, 9)
  })

  it('breaks a voiced excursion live, 200 ms after the centre leaves the band', () => {
    // Arrange: locked, then +80 cents. The centre is out from the 3rd tick
    // of the excursion; 12 out ticks later (0.2 s) is excursion tick 14.
    const locked = play(constant(60, 0)).state

    // Act
    const run = play(constant(60, 80), locked)

    // Assert
    expect(run.events).toEqual([[14, 'break']])
    expect(run.state.phase).toBe('broken')
    expect(run.state.lockSeconds).toBe(0)
    expect(run.state.longestLockSeconds).toBeCloseTo(62 / 60, 9)
  })

  it('does not count a pre-lock wander as a break', () => {
    // Arrange
    const readings = [...constant(10, 0), ...constant(60, 80)]

    // Act
    const run = play(readings)

    // Assert
    expect(run.state.phase).toBe('voiced')
    expect(run.state.breaks).toBe(0)
    expect(run.events).toEqual([])
  })

  it('rides out a 183 ms dropout without a break', () => {
    // Arrange: 11 silent ticks is 0.183 s, under breakMs.
    const locked = play(constant(60, 0)).state

    // Act
    const run = play([...constant(11, null), ...constant(60, 0)], locked)

    // Assert
    expect(run.events).toEqual([])
    expect(run.state.phase).toBe('locked')
    expect(run.state.breaks).toBe(0)
    expect(run.state.lockSeconds).toBeCloseTo(131 / 60, 9)
    expect(run.state.inBandSeconds).toBeCloseTo(120 / 60, 9)
  })

  it('counts a 250 ms dropout as one break when the voice comes back, then relocks', () => {
    // Arrange: 15 silent ticks. Silence might be the end of the note, so
    // the break waits for voiced evidence: the first tick back (16).
    const locked = play(constant(60, 0)).state

    // Act
    const run = play([...constant(15, null), ...constant(60, 0)], locked)

    // Assert
    expect(run.events).toEqual([
      [16, 'break'],
      [30, 'relock'],
    ])
    expect(run.state.breaks).toBe(1)
    expect(run.state.longestLockSeconds).toBeCloseTo(1, 9)
  })

  it('ignores a two-frame octave flicker and loses only two ticks to a three-frame one', () => {
    // Arrange: readings clamp to +100 cents. Two ticks lift the centre to
    // 28.4 (in band); a third to 39.4, and it is back in on the 2nd tick after.
    const locked = play(constant(60, 0)).state

    // Act
    const two = play([1200, 1200, ...constant(30, 0)], locked)
    const three = play([1200, 1200, 1200, ...constant(30, 0)], locked)

    // Assert
    expect(two.inBand.every(Boolean)).toBe(true)
    expect(two.events).toEqual([])
    expect(three.inBand.filter((inBand) => !inBand)).toHaveLength(2)
    expect(three.events).toEqual([])
    expect(three.state.phase).toBe('locked')
  })

  it('ends the note on the 27th silent tick (450 ms) and dates the end at the last voiced tick', () => {
    // Arrange
    const held = play(constant(120, 0)).state

    // Act
    const almost = play(constant(26, null), held)
    const done = play(constant(27, null), held)

    // Assert
    expect(almost.state.phase).toBe('locked')
    expect(almost.events).toEqual([])
    expect(done.events).toEqual([[27, 'end']])
    expect(done.state.phase).toBe('ended')
    expect(done.state.noteEndedAt).toBeCloseTo(2, 9)
  })

  it('does not count the release droop as a break', () => {
    // Arrange: the pitch falls 80 cents for 100 ms, then the voice stops.
    const held = play(constant(120, 0)).state

    // Act
    const run = play([...constant(6, -80), ...constant(27, null)], held)

    // Assert
    expect(run.events.map(([, event]) => event)).toEqual(['end'])
    expect(run.state.breaks).toBe(0)
  })

  it('changes nothing after the end', () => {
    // Arrange
    const ended = play([...constant(60, 0), ...constant(27, null)]).state

    // Act
    const after = play(constant(120, 0), ended)

    // Assert
    expect(after.events).toEqual([])
    expect(after.state.inBandSeconds).toBe(ended.inBandSeconds)
    expect(after.state.clock).toBe(ended.clock)
  })

  it('keeps waiting through silence before the first voiced tick', () => {
    // Arrange
    const readings = constant(120, null)

    // Act
    const run = play(readings)

    // Assert
    expect(run.state.phase).toBe('waiting')
    expect(run.state.firstVoicedAt).toBeNull()
    expect(run.state.needleCents).toBeNull()
    expect(run.events).toEqual([])
  })

  it('pauses the fill out of band and in silence, and never drains it', () => {
    // Arrange: 3 s on the note, 2 s at +80 (out from its 3rd tick), a
    // 300 ms gap, then 1 s back on the note.
    const readings = [
      ...constant(180, 0),
      ...constant(120, 80),
      ...constant(18, null),
      ...constant(60, 0),
    ]

    // Act
    const run = play(readings)

    // Assert
    const drops = run.charges.filter((c, i) => i > 0 && c < run.charges[i - 1])
    expect(drops).toEqual([])
    // Flat from the first out-of-band tick (182) through the gap (318).
    expect(run.charges[181]).toBe(run.charges[317])
    expect(run.charges[317]).toBeCloseTo(182 / 60 / 12, 9)
    expect(run.state.inBandSeconds).toBeCloseTo(242 / 60, 9)
  })

  it('fires the goal once, on the tick the twelfth in-band second completes', () => {
    // Arrange
    const readings = constant(900, 0)

    // Act
    const run = play(readings)

    // Assert
    expect(run.events).toEqual([
      [15, 'lock'],
      [720, 'goal'],
    ])
    expect(run.charges[718]).toBeLessThan(1)
    expect(run.state.charge).toBe(1)
    expect(run.state.inBandSeconds).toBeCloseTo(15, 9)
  })

  it('reads the goal and the tolerance from the preset', () => {
    // Arrange: a 2 s goal and a +-60 cent band; +50 cents is now in band.
    const easy: HoldPreset = { ...EXERCISE, goalSeconds: 2, tolCents: 60 }

    // Act
    const run = play(constant(150, 50), createHoldState(), easy)

    // Assert
    expect(run.events).toEqual([
      [15, 'lock'],
      [120, 'goal'],
    ])
  })
})

// ── The stretch: past the goal, only steady singing fills the top ──

const LANTERN = HOLD_PRESETS.lantern

/** A take's readings (cents off the note), one a tick, then a release. */
const sung = (shape: TakeShape): Array<number | null> => [
  ...takeCents(shape),
  ...constant(40, null),
]

/** The share of in-band ticks past the goal the engine judged steady. */
function steadyShare(readings: ReadonlyArray<number | null>): number {
  let state = createHoldState()
  let inBand = 0
  let steady = 0
  for (const offCents of readings) {
    const before = state
    state = tickHold(state, { offCents, level: 0.6, dt: DT }, LANTERN)
    if (!before.goalReached || !state.inBand) continue
    inBand += 1
    if (state.steady) steady += 1
  }
  return inBand === 0 ? 0 : steady / inBand
}

const PRACTISED: TakeShape = {
  seconds: 26,
  wanderCents: 4,
  wanderSeconds: 0.4,
  jitterCents: 3,
}

describe('tickHold, the lantern preset past the goal', () => {
  it('leaves a preset without a stretch rule as it was', () => {
    const run = play(sung({ ...PRACTISED, seed: 11 }))
    expect(run.events.map(([, event]) => event)).toEqual([
      'lock',
      'goal',
      'end',
    ])
    expect(run.state).toMatchObject({
      recent: [],
      steady: false,
      steadyCheckedAt: null,
      steadySeconds: 0,
      topCharge: 0,
      brimReached: false,
    })
  })

  it('fills the top with 12 steady seconds, a practised vibrato included', () => {
    for (const shape of [
      { ...PRACTISED, seed: 11 },
      { ...PRACTISED, vibratoHz: 5.5, vibratoCents: 35, seed: 12 },
      { ...PRACTISED, vibratoHz: 6, vibratoCents: 60, seed: 13 },
    ]) {
      // Act
      const run = play(sung(shape), createHoldState(), LANTERN)

      // Assert: the brim once, about 12 s after the goal, and no sooner.
      const at = (event: HoldEventType): number =>
        run.events.find(([, e]) => e === event)?.[0] ?? Number.NaN
      expect(run.events.map(([, event]) => event)).toEqual([
        'lock',
        'goal',
        'brim',
        'end',
      ])
      const stretch = (at('brim') - at('goal')) * DT
      expect(stretch).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(stretch).toBeLessThan(12.6)
      expect(run.state.topCharge).toBe(1)
    }
  })

  it('fills the top only partway for a voice that wobbles on the line', () => {
    // On the line all along (the goal comes at 12 s), but wobbling.
    const run = play(
      sung({ seconds: 26, wanderCents: 15, wanderSeconds: 0.2, seed: 18 }),
      createHoldState(),
      LANTERN,
    )
    expect(run.state.goalReached).toBe(true)
    expect(run.state.brimReached).toBe(false)
    expect(run.state.topCharge).toBeGreaterThan(0.1)
    expect(run.state.topCharge).toBeLessThan(0.9)
  })

  it('never drains the top: off the line and silent, it waits', () => {
    // Arrange: steady to 18 s, a stretch sharp, a breath, steady again.
    const readings = [
      ...takeCents({ ...PRACTISED, seconds: 18, seed: 4 }),
      ...constant(120, 70),
      ...constant(15, null),
      ...takeCents({ ...PRACTISED, seconds: 4, seed: 5 }),
    ]

    // Act
    let state = createHoldState()
    const tops: number[] = []
    for (const offCents of readings) {
      state = tickHold(state, { offCents, level: 0.6, dt: DT }, LANTERN)
      tops.push(state.topCharge)
    }

    // Assert: it rose, held while off the line, and rose again.
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1])
    }
    expect(tops[18 * 60 - 1]).toBeGreaterThan(0.3)
    // (The centre takes a few ticks to leave the band.)
    expect(tops[18 * 60 + 130]).toBe(tops[18 * 60 + 20])
    expect(tops[tops.length - 1]).toBeGreaterThan(tops[18 * 60 + 130])
  })

  it("judges steady by the result's own steadiness score", () => {
    // Takes the result scores high are steady past the goal nearly all of
    // the time; takes it scores low nearly never; the middle in between.
    const takes: TakeShape[] = [
      { ...PRACTISED, vibratoHz: 5.5, vibratoCents: 35, seed: 21 },
      { ...PRACTISED, seed: 22 },
      {
        seconds: 26,
        wanderCents: 12,
        wanderSeconds: 0.3,
        jitterCents: 4,
        seed: 24,
      },
      {
        seconds: 26,
        wanderCents: 15,
        wanderSeconds: 0.2,
        jitterCents: 4,
        seed: 18,
      },
      {
        seconds: 26,
        wanderCents: 22,
        wanderSeconds: 0.2,
        jitterCents: 5,
        seed: 19,
      },
    ]
    const rows = takes.map((shape) => {
      const frames = [
        ...realisticTake(57, shape),
        ...silence(0.6, shape.seconds),
      ]
      const score = computeHoldResult({
        frames,
        state: runHold(frames, 57, LANTERN),
        targetMidi: 57,
        durationMs: 1,
      }).score
      return { score, share: steadyShare(sung(shape)) }
    })
    for (const { score, share } of rows) {
      if (score >= 93) expect(share).toBeGreaterThan(0.95)
      if (score <= 70) expect(share).toBeLessThan(0.3)
    }
    // Steadier by the score, steadier live: the same order.
    const byScore = [...rows].sort((a, b) => a.score - b.score)
    for (let i = 1; i < byScore.length; i++) {
      expect(byScore[i].share).toBeGreaterThanOrEqual(byScore[i - 1].share)
    }
    expect(byScore[0].score).toBeLessThanOrEqual(70)
    expect(byScore[byScore.length - 1].score).toBeGreaterThanOrEqual(93)
  })
})
