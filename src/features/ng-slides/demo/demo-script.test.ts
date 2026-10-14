// ============================================================
// The Ng slides demo's script, replayed through the engine it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through tickGlide, here and not through the script's
// own pass, at every root the room can offer, and check that each event a
// tooltip waits for really fires, in order, and is what the tooltip says
// it is: take 1 jumps twice and stops once, and its arch stays dark in
// patches, short of Beginner's line; take 2 follows the line, reaches the
// top note and lights the arch.

import { describe, expect, it } from 'vitest'
import type { GlideEvent } from '@/lib/glide/glide-engine'
import { archCoverage, createGlideState, JUMP_CENTS, JUMP_PATH_CENTS, tickGlide, } from '@/lib/glide/glide-engine'
import { targetAt } from '@/lib/glide/glide-path'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { offTarget } from '@/lib/hold/hold-reading'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { COUNT_IN_TONE_SEC } from '../ng-run'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planNgDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { NgDemoTake } from './demo-script'
import { DEMO_LEVEL, DEMO_PRESET, DEMO_VIBRATO, demoTake, OFF_GAP, OFF_STEPS, } from './demo-script'

const ROOTS = Array.from(
  { length: HOLD_TARGET_MAX_MIDI - HOLD_TARGET_MIN_MIDI + 1 },
  (_, i) => HOLD_TARGET_MIN_MIDI + i,
)
const BEGINNER = NG_SLIDES_LEVELS.learning

interface Moment {
  /** Path seconds. */
  t: number
  event: GlideEvent
}

interface Replay {
  moments: Moment[]
  /** Every judged frame: path seconds, on the path or not, the voice (MIDI). */
  frames: { t: number; on: boolean; voice: number | null }[]
  coverage: number
}

/** A take's frames through a fresh engine, as the room's take ticks them. */
function replay(take: NgDemoTake): Replay {
  const { path, countIn } = take.plan
  const state = createGlideState(path)
  const moments: Moment[] = []
  const frames: Replay['frames'] = []
  for (const frame of take.frames) {
    const t = frame.t - countIn
    tickGlide(state, { ...frame, t }, path, DEMO_PRESET)
    for (const event of state.events) moments.push({ t, event: { ...event } })
    if (state.arch === 0) {
      frames.push({ t, on: state.following, voice: state.voiceMidi })
    }
  }
  return { moments, frames, coverage: archCoverage(state, path, 0) }
}

/** The events a tooltip can wait for, without the on and off of the light. */
const notable = (r: Replay): string[] =>
  r.moments
    .map((m) => m.event.type)
    .filter((type) => type !== 'onPath' && type !== 'offPath')

const first = (r: Replay, type: GlideEvent['type']): Moment => {
  const moment = r.moments.find((m) => m.event.type === type)
  if (moment === undefined) throw new Error(`no ${type}`)
  return moment
}

/** The stretches of the sung part the glass stayed dark, path seconds. */
function darkStretches(r: Replay): [number, number][] {
  const out: [number, number][] = []
  let from: number | null = null
  for (const frame of r.frames) {
    if (!frame.on && from === null) from = frame.t
    if (frame.on && from !== null) {
      out.push([from, frame.t])
      from = null
    }
  }
  if (from !== null) out.push([from, r.frames[r.frames.length - 1].t])
  return out
}

describe("the demo's takes, at every root the room offers", () => {
  it('take 1 jumps twice on the way up, stops once on the way down, and its arch stays unlit', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('off', root))
      expect(notable(r), `root ${root}`).toEqual([
        'jump',
        'jump',
        'top',
        'break',
        'archEnd',
        'end',
      ])
      const end = first(r, 'archEnd').event
      expect(end).toMatchObject({ type: 'archEnd', lit: false })
      expect(r.coverage).toBeLessThan(BEGINNER.litShare)
    }
  })

  it('take 2 follows the line with no jump and no break, reaches the top and lights the arch', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('on', root))
      expect(notable(r), `root ${root}`).toEqual(['top', 'archEnd', 'end'])
      expect(first(r, 'archEnd').event).toMatchObject({ lit: true })
      expect(r.coverage, `root ${root}`).toBeGreaterThan(0.98)
    }
  })

  it("matches the takes' own events, which the room and the plan run on", () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 52, HOLD_TARGET_MAX_MIDI]) {
      for (const id of ['off', 'on'] as const) {
        const take = demoTake(id, root)
        const r = replay(take)
        expect(take.events).toEqual(
          r.moments.map((m) => ({
            type: m.event.type,
            at: m.t + take.plan.countIn,
          })),
        )
        expect(take.coverage).toBeCloseTo(r.coverage, 9)
      }
    }
  })

  it('is the same take every time for the same root', () => {
    expect(demoTake('off', 50)).toEqual(demoTake('off', 50))
    expect(demoTake('on', 50)).toEqual(demoTake('on', 50))
  })
})

describe('what each tooltip says is what happened', () => {
  it('"Jumping note to note leaves gaps": two steps, each after the glass went dark under a held note', () => {
    const take = demoTake('off', 50)
    const r = replay(take)
    const path = take.plan.path
    const jumps = r.moments.filter((m) => m.event.type === 'jump')
    const dark = darkStretches(r)
    for (const jump of jumps) {
      const event = jump.event
      if (event.type !== 'jump') continue
      const { fromMidi, toMidi } = event
      // A step of a third or more, while the line moved a little.
      expect(Math.abs(toMidi - fromMidi) * 100).toBeGreaterThanOrEqual(
        JUMP_CENTS,
      )
      const move =
        Math.abs(
          (targetAt(path, event.t) ?? 0) -
            (targetAt(path, event.t - 0.05) ?? 0),
        ) * 100
      expect(move).toBeLessThan(JUMP_PATH_CENTS)
      // The held note had left the line: dark for a quarter second or more.
      const before = dark.find(([a, b]) => b >= event.t - 0.05 && a < event.t)
      expect(before, `before the jump at ${event.t}`).toBeDefined()
      const [a, b] = before ?? [0, 0]
      expect(b - a).toBeGreaterThanOrEqual(0.25)
    }
    // The steps the script means: root to third, third to fifth.
    expect(
      jumps.map((m) =>
        m.event.type === 'jump'
          ? [Math.round(m.event.fromMidi - 50), Math.round(m.event.toMidi - 50)]
          : [],
      ),
    ).toEqual([
      [0, 4],
      [4, 7],
    ])
    expect(jumps[0].event).toMatchObject({
      t: expect.closeTo(OFF_STEPS.third, 1),
    })
  })

  it('"Jumping note to note leaves gaps": the arch is lit only in patches, three of them dark', () => {
    const r = replay(demoTake('off', 50))
    const long = darkStretches(r).filter(([a, b]) => b - a >= 0.25)
    expect(long.length).toBeGreaterThanOrEqual(3)
    // A third of the arch or more stays dark.
    expect(1 - r.coverage).toBeGreaterThan(0.3)
  })

  it('"When the hum stops, the light stops": silent for half a second, and no glass lit through it', () => {
    const r = replay(demoTake('off', 50))
    const moment = first(r, 'break')
    if (moment.event.type !== 'break') throw new Error('no break')
    expect(moment.event.t).toBeCloseTo(OFF_GAP.from, 1)
    const silent = r.frames.filter(
      (f) => f.t >= OFF_GAP.from && f.t < OFF_GAP.to,
    )
    expect(silent.length).toBeGreaterThan(25)
    expect(silent.every((f) => f.voice === null && !f.on)).toBe(true)
    // The light comes back with the hum, on the line.
    const after = r.frames.find((f) => f.t >= OFF_GAP.to + 0.05)
    expect(after?.on).toBe(true)
  })

  it('"Slide through every note and it lights": take 2 is on the line from its first note to its last', () => {
    const r = replay(demoTake('on', 50))
    const on = first(r, 'onPath')
    expect(on.t).toBeLessThan(0.05)
    expect(darkStretches(r)).toEqual([])
    expect(r.moments.filter((m) => m.event.type === 'offPath')).toEqual([])
  })

  it('"Turn at the top note": take 2 reaches the top note and holds it before it turns', () => {
    const take = demoTake('on', 50)
    const r = replay(take)
    const top = first(r, 'top')
    const arch = take.plan.path.arches[0]
    expect(top.t).toBeGreaterThan(arch.topStart - 0.1)
    expect(top.t).toBeLessThan(arch.topEnd)
    const there = r.frames.filter(
      (f) => f.t >= arch.topStart + 0.1 && f.t <= arch.topEnd,
    )
    for (const f of there) {
      expect(Math.abs(((f.voice ?? 0) - arch.topMidi) * 100)).toBeLessThan(
        DEMO_PRESET.top?.tolCents ?? 0,
      )
    }
  })

  it('"Your score is how much of the bridge you light": the score is the lit share, and take 2 lights it all', () => {
    const r = replay(demoTake('on', 50))
    const end = first(r, 'archEnd').event
    expect(end).toMatchObject({ type: 'archEnd', lit: true })
    if (end.type === 'archEnd') expect(end.coverage).toBeCloseTo(r.coverage, 9)
  })
})

describe("the demo's rules, clocks and voice", () => {
  it("sings at Beginner's timing and band, with the top note checked so `top` fires", () => {
    expect(DEMO_LEVEL).toBe('learning')
    const { top, ...rest } = DEMO_PRESET
    const { top: beginnerTop, ...beginner } = BEGINNER
    expect(rest).toEqual(beginner)
    expect(beginnerTop).toBeNull()
    expect(top).toEqual(NG_SLIDES_LEVELS.professional.top)
  })

  it('plays every take at its own speed: no fast-forward, one clock, ending as the path does', () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 52, HOLD_TARGET_MAX_MIDI]) {
      for (const id of ['off', 'on'] as const) {
        const take = demoTake(id, root)
        expect(take.fast, `${id} ${root}`).toEqual([])
        for (const event of take.events) {
          expect(take.wallAt(event.at)).toBe(event.at)
          expect(take.engineAt(event.at)).toBe(event.at)
        }
        const end = take.events.find((e) => e.type === 'end')?.at
        expect(take.length).toBe(end)
        expect(take.length).toBeCloseTo(
          take.plan.countIn + take.plan.path.duration,
          6,
        )
      }
    }
    expect(DEMO_COPY).not.toHaveProperty('fast')
  })

  it("counts in as the room does: the root's tone, then a breath", () => {
    const take = demoTake('on', 50)
    expect(take.plan.countIn).toBeCloseTo(
      COUNT_IN_TONE_SEC + BEGINNER.breathSec,
      9,
    )
    // Silent until the slide starts.
    const before = take.frames.filter((f) => f.t < take.plan.countIn - 1e-9)
    expect(before.every((f) => f.f0 === 0)).toBe(true)
  })

  it("moves at the slide's own pace: up in 1.5 s, at the top for 0.5 s, down in 1.5 s", () => {
    const take = demoTake('on', 50)
    const { countIn, path } = take.plan
    const arch = path.arches[0]
    expect([
      arch.topStart - arch.start,
      arch.topEnd - arch.topStart,
      arch.end - arch.topEnd,
    ]).toEqual([BEGINNER.upSec, BEGINNER.topSec, BEGINNER.downSec])
    // The hum reaches the top note within a breath of the line, and leaves
    // it as the line does.
    const sung = take.voice.filter((p) => p.level > 0)
    const atTop = sung.filter((p) => p.cents > 690)
    const reach = atTop[0].t - countIn
    const leave = atTop[atTop.length - 1].t - countIn
    expect(reach).toBeGreaterThan(arch.topStart - 0.3)
    expect(reach).toBeLessThan(arch.topStart + 0.15)
    expect(leave).toBeGreaterThan(arch.topEnd - 0.05)
    expect(leave).toBeLessThan(arch.topEnd + 0.3)
    // Take 1 spends the same up time getting there, in steps.
    const off = demoTake('off', 50)
    const fifth = off.voice.find(
      (p) => p.level > 0 && p.cents > 690 && p.t > countIn,
    )
    expect((fifth?.t ?? 0) - countIn).toBeCloseTo(OFF_STEPS.fifth, 1)
  })

  it('hums what the frames carry: the voice follows the frames to within the vibrato', () => {
    for (const id of ['off', 'on'] as const) {
      const take = demoTake(id, 50)
      let worst = 0
      let compared = 0
      // At the very instant of a step, which side a moment falls on is
      // the float's rounding: those moments are left out.
      const steps = [
        OFF_STEPS.third,
        OFF_STEPS.fifth,
        OFF_GAP.from,
        OFF_GAP.to,
      ].map((s) => s + take.plan.countIn)
      for (const point of take.voice) {
        if (point.level <= 0) continue
        if (steps.some((s) => Math.abs(s - point.t) < 1e-6)) continue
        // The moments a voice point and a frame share (every 50 ms).
        const frame = take.frames.find((f) => Math.abs(f.t - point.t) < 1e-6)
        const cents = frame === undefined ? null : offTarget(frame, 50)
        if (cents === null) continue
        compared += 1
        worst = Math.max(worst, Math.abs(cents - point.cents))
      }
      expect(compared, id).toBeGreaterThan(50)
      // Vibrato and the tracker's grain are in the frames, not the contour.
      expect(worst, id).toBeLessThan(DEMO_VIBRATO.cents + 3)
    }
  })

  it('gives every tooltip time to be read before the next takes its place', () => {
    for (const root of ROOTS) {
      const plan = planNgDemo(root)
      const offOver =
        plan.takeStart.off + plan.takes.off.length + DEMO_BEATS.afterOff
      plan.cues.forEach((cue, i) => {
        const take = DEMO_CUES[i].trigger.take
        // Up until the next tooltip, the reset after take 1, or the end card.
        const ends = [
          plan.cues[i + 1]?.at ?? plan.total,
          take === 'off' ? offOver : plan.total,
        ]
        const up = Math.min(...ends) - cue.at
        expect(up, `${cue.id} at root ${root}`).toBeGreaterThanOrEqual(
          TIP_READ_SECONDS,
        )
      })
    }
  })

  it('lasts about 19 s, every tooltip inside its take, in order', () => {
    const plan = planNgDemo(50)
    expect(plan.total).toBeGreaterThan(18.5)
    expect(plan.total).toBeLessThan(19.2)
    const order = plan.cues.map((cue) => cue.id)
    expect(order).toEqual(DEMO_CUES.map((cue) => cue.id))
    const ats = plan.cues.map((cue) => cue.at)
    expect([...ats].sort((a, b) => a - b)).toEqual(ats)
    const offEnd = plan.takeStart.off + plan.takes.off.length
    const onStart = plan.takeStart.on
    for (const cue of plan.cues) {
      const take = DEMO_CUES.find((c) => c.id === cue.id)?.trigger.take
      if (take === 'off') {
        expect(cue.at).toBeGreaterThan(plan.takeStart.off)
        expect(cue.at).toBeLessThan(offEnd)
      }
      if (take === 'on') expect(cue.at).toBeGreaterThan(onStart)
      expect(cue.at).toBeLessThan(plan.total)
    }
  })
})

describe("the demo's words", () => {
  const words = [
    ...Object.values(DEMO_COPY),
    ...DEMO_CUES.map((cue) => demoCueText(cue.id)),
  ]

  it("say the design's lines: gaps, the light stopping, the slide, the turn and the score", () => {
    expect(DEMO_CUES.map((cue) => demoCueText(cue.id))).toEqual([
      'Jumping note to note leaves gaps.',
      'When the hum stops, the light stops.',
      'Slide through every note and it lights.',
      'Turn at the top note.',
      'Your score is how much of the bridge you light.',
    ])
  })

  it('make no claim about the mouth or the hum: the app hears pitch', () => {
    for (const text of words) expect(text).not.toMatch(/mouth|lips|nasal/iu)
  })

  it('keep out em dashes, "calm" and "practise"', () => {
    for (const text of words) {
      expect(text).not.toMatch(/—/u)
      expect(text).not.toMatch(/calm/iu)
      expect(text).not.toMatch(/practis/iu)
    }
  })
})
