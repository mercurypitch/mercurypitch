// Voice Mirror — demo audio cue planning + playback.
// Requirements: docs/specs/mirror-demo-audio-cues.ears.md (MDA-*)

import { describe, expect, it } from 'vitest'
import { createDemoCue, planDemoCue, playDemoCue, } from '@/features/mirror/demo-cue'
import { playSirenSweep } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { DemoTimeline } from '@/lib/mirror/demo-timeline'
import { buildDemoTimeline } from '@/lib/mirror/demo-timeline'

// Demo timelines sit in a fixed neutral register (demo-timeline.ts):
const LOW = midiToFrequency(50) // glide bottom / glide-down target
const HIGH = midiToFrequency(62) // glide top
const HOLD = midiToFrequency(56) // held note

function singSeconds(tl: DemoTimeline): number {
  const sing = tl.segments.find((s) => s.kind === 'sing')
  if (!sing) throw new Error('no sing segment')
  return sing.end - sing.start
}

/** A capturing fake AudioContext that records oscillator frequency automation,
 *  oscillator stops, and resume() calls. `state` is fixed at construction. */
function fakeContext(state: AudioContextState = 'running') {
  const counters = { stops: 0, resumes: 0 }
  const oscillators: Array<{
    frequency: { value: number; setCalls: number[]; rampCalls: number[] }
  }> = []
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  })
  const ctx = {
    currentTime: 0,
    state,
    destination: {},
    resume: () => {
      counters.resumes++
      return Promise.resolve()
    },
    createGain: () => ({
      gain: param(),
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    createOscillator: () => {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: {
          value: 0,
          setCalls: [] as number[],
          rampCalls: [] as number[],
          setValueAtTime(v: number) {
            this.value = v
            this.setCalls.push(v)
          },
          exponentialRampToValueAtTime(v: number) {
            this.rampCalls.push(v)
          },
        },
        connect: () => undefined,
        start: () => undefined,
        stop: () => {
          counters.stops++
        },
      }
      oscillators.push(osc)
      return osc
    },
  }
  return { ctx: ctx as unknown as AudioContext, oscillators, counters }
}

describe('planDemoCue', () => {
  it('MDA-1: glide-up is an ascending sweep across the guide, sized to the sing window', () => {
    const tl = buildDemoTimeline('glide-up')
    const plan = planDemoCue('glide-up', tl)
    expect(plan?.type).toBe('sweep')
    if (plan?.type !== 'sweep') throw new Error('expected sweep')
    expect(plan.fromHz).toBeCloseTo(LOW, 2)
    expect(plan.toHz).toBeCloseTo(HIGH, 2)
    expect(plan.fromHz).toBeLessThan(plan.toHz)
    expect(plan.seconds).toBeCloseTo(singSeconds(tl), 6)
  })

  it('MDA-2: glide-down is a descending sweep (fromHz > toHz)', () => {
    const tl = buildDemoTimeline('glide-down')
    const plan = planDemoCue('glide-down', tl)
    expect(plan?.type).toBe('sweep')
    if (plan?.type !== 'sweep') throw new Error('expected sweep')
    expect(plan.fromHz).toBeCloseTo(HIGH, 2)
    expect(plan.toHz).toBeCloseTo(LOW, 2)
    expect(plan.fromHz).toBeGreaterThan(plan.toHz)
    expect(plan.seconds).toBeCloseTo(singSeconds(tl), 6)
  })

  it('MDA-3: hold is a steady tone at the guide pitch, sized to the sing window', () => {
    const tl = buildDemoTimeline('hold')
    const plan = planDemoCue('hold', tl)
    expect(plan?.type).toBe('hold')
    if (plan?.type !== 'hold') throw new Error('expected hold')
    expect(plan.hz).toBeCloseTo(HOLD, 2)
    expect(plan.seconds).toBeCloseTo(singSeconds(tl), 6)
  })

  it('MDA-4: match has no glide/hold cue', () => {
    expect(planDemoCue('match', buildDemoTimeline('match'))).toBeNull()
  })

  it('MDA-5: degenerate timelines produce no cue', () => {
    const noSing: DemoTimeline = {
      durationSec: 1,
      voice: [],
      guide: [{ t: 0, f0: HOLD, conf: 1 }],
      segments: [{ kind: 'rest', start: 0, end: 1 }],
      centsMin: 0,
      centsMax: 1,
    }
    expect(planDemoCue('hold', noSing)).toBeNull()

    const badGuide: DemoTimeline = {
      durationSec: 1,
      voice: [],
      guide: [{ t: 0, f0: 0, conf: 1 }],
      segments: [{ kind: 'sing', start: 0, end: 1 }],
      centsMin: 0,
      centsMax: 1,
    }
    expect(planDemoCue('glide-up', badGuide)).toBeNull()
  })
})

describe('playSirenSweep direction (MDA-6)', () => {
  it('ramps the oscillator from fromHz up to toHz', () => {
    const { ctx, oscillators } = fakeContext()
    playSirenSweep(ctx, { fromHz: 200, toHz: 800, seconds: 3 })
    expect(oscillators[0].frequency.setCalls[0]).toBeCloseTo(200, 6)
    expect(oscillators[0].frequency.rampCalls[0]).toBeCloseTo(800, 6)
  })

  it('ramps downward when fromHz > toHz', () => {
    const { ctx, oscillators } = fakeContext()
    playSirenSweep(ctx, { fromHz: 800, toHz: 200, seconds: 3 })
    expect(oscillators[0].frequency.setCalls[0]).toBeCloseTo(800, 6)
    expect(oscillators[0].frequency.rampCalls[0]).toBeCloseTo(200, 6)
  })
})

describe('playDemoCue dispatch', () => {
  it('sweeps for a glide plan, in the planned direction', () => {
    const { ctx, oscillators } = fakeContext()
    const tl = buildDemoTimeline('glide-down')
    const plan = planDemoCue('glide-down', tl)
    if (!plan) throw new Error('expected a plan')
    const handle = playDemoCue(ctx, plan)
    expect(oscillators[0].frequency.setCalls[0]).toBeGreaterThan(
      oscillators[0].frequency.rampCalls[0],
    )
    expect(() => handle.stop()).not.toThrow()
  })

  it('holds a steady tone for a hold plan', () => {
    const { ctx, oscillators } = fakeContext()
    const plan = planDemoCue('hold', buildDemoTimeline('hold'))
    if (!plan) throw new Error('expected a plan')
    playDemoCue(ctx, plan)
    // A steady tone sets .value directly with no frequency ramp.
    expect(oscillators[0].frequency.value).toBeCloseTo(HOLD, 2)
    expect(oscillators[0].frequency.rampCalls).toHaveLength(0)
  })
})

describe('createDemoCue lifecycle', () => {
  const glidePlan = planDemoCue('glide-up', buildDemoTimeline('glide-up'))

  it('MDA-7: plays once when shown, stops when hidden, replays on re-show', () => {
    const { ctx, oscillators, counters } = fakeContext()
    const cue = createDemoCue(glidePlan, () => ctx)

    cue.sync(true)
    expect(oscillators).toHaveLength(1) // started
    cue.sync(true) // idempotent — no double-start
    expect(oscillators).toHaveLength(1)

    cue.sync(false)
    expect(counters.stops).toBeGreaterThan(0) // stopped

    cue.sync(true)
    expect(oscillators).toHaveLength(2) // replayed on re-show
  })

  it('MDA-7: stop() releases the active cue', () => {
    const { ctx, counters } = fakeContext()
    const cue = createDemoCue(glidePlan, () => ctx)
    cue.sync(true)
    cue.stop()
    expect(counters.stops).toBeGreaterThan(0)
  })

  it('MDA-4/8: never plays when there is no cue plan', () => {
    const { ctx, oscillators } = fakeContext()
    const cue = createDemoCue(null, () => ctx)
    cue.sync(true)
    expect(oscillators).toHaveLength(0)
  })

  it('MDA-8: stays silent with no context, and retries once one appears', () => {
    let ctxRef: AudioContext | null = null
    const cue = createDemoCue(glidePlan, () => ctxRef)

    cue.sync(true) // no context yet → silent, and NOT latched as "playing"
    // Now a context appears; the next sync must actually start the cue.
    const live = fakeContext()
    ctxRef = live.ctx
    cue.sync(true)
    expect(live.oscillators).toHaveLength(1)
  })

  it('MDA-8: stays silent for a closed context', () => {
    const { ctx, oscillators } = fakeContext('closed')
    const cue = createDemoCue(glidePlan, () => ctx)
    cue.sync(true)
    expect(oscillators).toHaveLength(0)
  })

  it('MDA-9: resumes a suspended context before scheduling the cue', () => {
    const { ctx, oscillators, counters } = fakeContext('suspended')
    const cue = createDemoCue(glidePlan, () => ctx)
    cue.sync(true)
    expect(counters.resumes).toBe(1)
    expect(oscillators).toHaveLength(1)
  })
})
