import { describe, expect, it } from 'vitest'
import type { HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import { computeHoldResult } from '@/lib/hold/hold-metrics'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { hzToCents } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { levelFromRms } from '../useLongNoteController'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLongNoteDemo, } from './demo-cues'
import { DEMO_FAST_RATE, demoTake, rmsForLevel } from './demo-script'

// The room's own preset: the goal fills it halfway, steady singing the top.
const PRESET = HOLD_PRESETS.lantern
const A3 = 57

interface Tick {
  frame: PitchFrame
  state: HoldState
}

/** The take through the engine, one state per frame, as the room ticks it. */
function replay(frames: readonly PitchFrame[], note: number): Tick[] {
  let state = createHoldState()
  let previous: PitchFrame | null = null
  return frames.map((frame) => {
    state = tickHold(state, holdTickFromFrame(frame, previous, note), PRESET)
    previous = frame
    return { frame, state }
  })
}

function eventTimes(ticks: readonly Tick[]): { type: string; at: number }[] {
  return ticks.flatMap(({ state }) =>
    state.events.map((type) => ({ type, at: state.clock })),
  )
}

const voiced = (frame: PitchFrame): boolean => frame.f0 > 0 && frame.conf >= 0.5
const centsOff = (frame: PitchFrame, note: number): number =>
  hzToCents(frame.f0) - note * 100

describe('Long note demo, take 1 (not like this)', () => {
  const take = demoTake('off', A3)
  const ticks = replay(take.frames, A3)
  const events = eventTimes(ticks)
  const at = (type: string): number =>
    events.find((event) => event.type === type)?.at ?? Number.NaN

  it('locks, breaks on the drift and ends on the breath, nothing else', () => {
    expect(events.map((event) => event.type)).toEqual(['lock', 'break', 'end'])
  })

  it('breaks while the voice is still sounding, sharp of the band', () => {
    const tick = ticks.find(({ state }) => state.events.includes('break'))
    expect(tick).toBeDefined()
    if (tick === undefined) return
    expect(voiced(tick.frame)).toBe(true)
    expect(tick.state.needleCents ?? 0).toBeGreaterThan(PRESET.tolCents)
    // The drift starts after a real stretch on the line.
    expect(at('break') - at('lock')).toBeGreaterThan(1.2)
  })

  it('stops filling the moment it leaves the band, and never drains', () => {
    const left = ticks.findIndex(
      ({ state }, i) => i > 0 && !state.inBand && ticks[i - 1].state.inBand,
    )
    expect(left).toBeGreaterThan(0)
    const charge = ticks[left].state.charge
    expect(charge).toBeGreaterThan(0.1)
    for (const { state } of ticks.slice(left)) {
      expect(state.charge).toBe(charge)
    }
  })

  it('ends 0.45 s into the silence that follows the drift', () => {
    const lastVoiced = [...ticks].reverse().find(({ frame }) => voiced(frame))
    expect(lastVoiced).toBeDefined()
    if (lastVoiced === undefined) return
    expect(at('end') - lastVoiced.state.clock).toBeCloseTo(
      PRESET.endMs / 1000,
      1,
    )
    // Out of the band, but singing, right up to the breath.
    expect(centsOff(lastVoiced.frame, A3)).toBeGreaterThan(PRESET.tolCents)
    expect(take.length).toBeCloseTo(at('end'), 6)
  })
})

describe('Long note demo, take 2 (like this)', () => {
  const take = demoTake('on', A3)
  const ticks = replay(take.frames, A3)
  const events = eventTimes(ticks)
  const at = (type: string): number =>
    events.find((event) => event.type === type)?.at ?? Number.NaN
  const final = ticks[ticks.length - 1].state

  it('locks, fills the lantern to the brim and ends, without a break', () => {
    expect(events.map((event) => event.type)).toEqual([
      'lock',
      'goal',
      'brim',
      'end',
    ])
    expect(final.charge).toBe(1)
    expect(final.goalReached).toBe(true)
    expect(final.topCharge).toBe(1)
    expect(final.brimReached).toBe(true)
  })

  it('reaches the goal on 12 seconds in the band, the brim on 12 steady more', () => {
    const goal = ticks.find(({ state }) => state.events.includes('goal'))
    expect(goal?.state.inBandSeconds).toBeGreaterThanOrEqual(
      PRESET.goalSeconds - 1e-6,
    )
    // Steady all the way past the goal: the brim comes as soon as it can.
    const brim = ticks.find(({ state }) => state.events.includes('brim'))
    expect(brim?.state.steadySeconds).toBeGreaterThanOrEqual(12 - 1e-6)
    expect(at('brim') - at('goal')).toBeLessThan(12.3)
  })

  it('scores as a steady hold', () => {
    const result = computeHoldResult({
      frames: take.frames,
      state: final,
      targetMidi: A3,
      durationMs: 0,
    })
    expect(result.locked).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(90)
  })

  it('lets go of the note 0.3 to 0.4 s after the brim', () => {
    const lastVoiced = [...ticks].reverse().find(({ frame }) => voiced(frame))
    expect(lastVoiced).toBeDefined()
    if (lastVoiced === undefined) return
    const release = lastVoiced.state.clock - at('brim')
    expect(release).toBeGreaterThanOrEqual(0.3)
    expect(release).toBeLessThanOrEqual(0.4)
  })

  it('plays to the goal and on to the brim at 4x, the step out between at 1x', () => {
    const [toGoal, toBrim] = take.fast
    expect(take.fast).toHaveLength(2)
    expect(toGoal.from).toBeGreaterThan(at('lock'))
    expect(toGoal.to).toBeCloseTo(at('goal'), 6)
    // A moment at its own speed while Merc hops out of the glass.
    expect(toBrim.from - toGoal.to).toBeCloseTo(0.8, 6)
    expect(take.wallAt(toBrim.from) - take.wallAt(toGoal.to)).toBeCloseTo(
      0.8,
      6,
    )
    expect(toBrim.to).toBeCloseTo(at('brim'), 6)
    for (const stretch of take.fast) {
      const wall = take.wallAt(stretch.to) - take.wallAt(stretch.from)
      expect(wall * DEMO_FAST_RATE).toBeCloseTo(stretch.to - stretch.from, 6)
    }
    for (const e of [
      0,
      1,
      toGoal.from + 1,
      at('goal'),
      at('goal') + 0.5,
      toBrim.from + 2,
      at('brim'),
      at('end'),
    ]) {
      expect(take.engineAt(take.wallAt(e))).toBeCloseTo(e, 6)
    }
  })
})

describe('Long note demo, the script', () => {
  it('gives the same frames for the same note', () => {
    expect(demoTake('on', A3).frames).toEqual(demoTake('on', A3).frames)
    expect(demoTake('off', 50).frames).toEqual(demoTake('off', 50).frames)
  })

  it('tells the same story on every note the room offers', () => {
    for (
      let note = HOLD_TARGET_MIN_MIDI;
      note <= HOLD_TARGET_MAX_MIDI;
      note++
    ) {
      const off = eventTimes(replay(demoTake('off', note).frames, note))
      const on = eventTimes(replay(demoTake('on', note).frames, note))
      expect(off.map((event) => event.type)).toEqual(['lock', 'break', 'end'])
      expect(on.map((event) => event.type)).toEqual([
        'lock',
        'goal',
        'brim',
        'end',
      ])
    }
  })

  it('sings where the frames are voiced, on the frames own line', () => {
    const take = demoTake('off', A3)
    for (const point of take.voice) {
      const i = Math.round(take.engineAt(point.t) * 60)
      const [before, frame, after] = take.frames.slice(i - 1, i + 2)
      // Skip the frame either side of an onset or a release.
      if (after === undefined || voiced(before) !== voiced(after)) continue
      expect(point.level > 0).toBe(voiced(frame))
      if (point.level === 0) continue
      // The frames add vibrato and a grain of jitter on top of the line.
      expect(Math.abs(centsOff(frame, A3) - point.cents)).toBeLessThan(20)
    }
  })

  it("speaks Merc's loudness in the room's own scale", () => {
    for (const level of [0.2, 0.5, 0.8, 1]) {
      expect(levelFromRms(rmsForLevel(level))).toBeCloseTo(level, 6)
    }
  })
})

describe('Long note demo, the plan', () => {
  const plan = planLongNoteDemo(A3)

  it('shows every tooltip after the moment it explains', () => {
    for (const cue of plan.cues) {
      expect(cue.at).toBeGreaterThan(cue.trigger)
    }
    const at = (id: string): number =>
      plan.cues.find((cue) => cue.id === id)?.at ?? Number.NaN
    const offEnd = plan.takeStart.off + plan.takes.off.length
    // "It stops filling" while the voice is still off the line.
    expect(at('stops')).toBeLessThan(offEnd)
    expect(at('breath')).toBeGreaterThan(offEnd)
    // "12 seconds fill it halfway" before the goal; "only steady singing
    // fills the top" after it, while the top is still filling.
    expect(at('twelve')).toBeLessThan(plan.goal)
    expect(at('steady')).toBeGreaterThan(plan.goal)
    expect(at('steady')).toBeLessThan(plan.brim - 1.5)
    expect(at('score')).toBeGreaterThan(
      plan.takeStart.on + plan.takes.on.length,
    )
  })

  it('shows one tooltip at a time, in order, each long enough to read', () => {
    const times = plan.cues.map((cue) => cue.at)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThan(1.1)
    }
    expect(plan.total - times[times.length - 1]).toBeGreaterThan(1.5)
  })

  it('runs about 20 seconds, intro to end card', () => {
    expect(plan.total).toBeGreaterThan(18.5)
    expect(plan.total).toBeLessThanOrEqual(20.5)
    expect(plan.takeStart.off).toBeCloseTo(DEMO_BEATS.intro + DEMO_BEATS.lead)
  })

  it('names the room’s note, or the note when it has none', () => {
    expect(demoCueText('line', 'A3', true)).toBe('This line is your note: A3.')
    expect(demoCueText('line', 'E3', false)).toBe('This line is the note: E3.')
  })

  it('keeps to the house voice', () => {
    const words = [
      ...Object.values(DEMO_COPY),
      ...DEMO_CUES.map((cue) => demoCueText(cue.id, 'A3', true)),
    ]
    for (const text of words) {
      expect(text).not.toMatch(/—|calm|practise/i)
    }
  })
})
