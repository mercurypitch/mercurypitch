// ============================================================
// The Lip roll demo's script, replayed through the engine it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through tickGlide, here and not through the script's
// own pass, at every root the room can offer, and check that each event a
// tooltip waits for really fires, in order, and is what the tooltip says
// it is: take 1 leaves the path halfway up, its top stays dark and its
// wave short of Learning's lit share, and its buzz stops once on the way
// down; take 2 rides the crest, reaches the top and lights the wave.

import { describe, expect, it } from 'vitest'
import type { GlideEvent } from '@/lib/glide/glide-engine'
import { archCoverage, createGlideState, tickGlide, } from '@/lib/glide/glide-engine'
import { LIP_ROLL_SEMITONES } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { offTarget } from '@/lib/hold/hold-reading'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createBayScroll, holdCamera } from '../bay-scroll'
import { COUNT_IN_TONE_SEC } from '../lip-run'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLipDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { LipDemoTake } from './demo-script'
import { DEMO_HOLD, DEMO_LEVEL, DEMO_PRESET, demoTake, OFF_GAP, RIDE_LAG_SEC, STOP_SHORT_CENTS, } from './demo-script'

const ROOTS = Array.from(
  { length: HOLD_TARGET_MAX_MIDI - HOLD_TARGET_MIN_MIDI + 1 },
  (_, i) => HOLD_TARGET_MIN_MIDI + i,
)
const BEGINNER = LIP_ROLL_LEVELS.learning

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
function replay(take: LipDemoTake): Replay {
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

/** The events a tooltip can wait for, without the light going on and off. */
const notable = (r: Replay): string[] =>
  r.moments
    .map((m) => m.event.type)
    .filter((type) => type !== 'onPath' && type !== 'offPath')

const first = (r: Replay, type: GlideEvent['type']): Moment => {
  const moment = r.moments.find((m) => m.event.type === type)
  if (moment === undefined) throw new Error(`no ${type}`)
  return moment
}

describe("the demo's takes, at every root the room offers", () => {
  it('take 1 leaves the path, breaks once, and its wave stays unlit, its top dark', () => {
    for (const root of ROOTS) {
      const take = demoTake('off', root)
      const r = replay(take)
      expect(notable(r), `root ${root}`).toEqual(['break', 'archEnd', 'end'])
      expect(first(r, 'archEnd').event).toMatchObject({ lit: false })
      expect(r.coverage, `root ${root}`).toBeLessThan(BEGINNER.litShare)
      // Off the path at the crest: no frame of the top is lit.
      const wave = take.plan.path.arches[0]
      const top = r.frames.filter(
        (f) => f.t >= wave.topStart && f.t <= wave.topEnd,
      )
      expect(top.length).toBeGreaterThan(20)
      expect(top.every((f) => !f.on)).toBe(true)
    }
  })

  it('take 2 rides the crest with no jump and no break, reaches the top and lights the wave', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('on', root))
      expect(notable(r), `root ${root}`).toEqual(['top', 'archEnd', 'end'])
      expect(first(r, 'archEnd').event).toMatchObject({ lit: true })
      expect(r.coverage, `root ${root}`).toBeGreaterThan(BEGINNER.litShare)
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
  it('"Stop short and the top stays dark": off the path halfway up, held there, the top unlit', () => {
    const take = demoTake('off', 50)
    const r = replay(take)
    const wave = take.plan.path.arches[0]
    const off = first(r, 'offPath')
    // He leaves the path on the way up, before the crest.
    expect(off.t).toBeGreaterThan(wave.start + 1)
    expect(off.t).toBeLessThan(wave.topStart)
    // Five semitones up, and held: he never goes higher.
    const sung = r.frames.filter((f) => f.voice !== null)
    const highest = Math.max(...sung.map((f) => (f.voice ?? 0) - 50))
    expect(highest * 100).toBeGreaterThan(STOP_SHORT_CENTS - 10)
    expect(highest * 100).toBeLessThan(STOP_SHORT_CENTS + 10)
    // Dark from where he stopped until the crest has come back down to him.
    const dark = r.frames.filter((f) => f.t >= off.t && f.t < 3.8)
    expect(dark.every((f) => !f.on)).toBe(true)
    expect(STOP_SHORT_CENTS).toBe(500)
    expect(LIP_ROLL_SEMITONES).toBe(12)
  })

  it('"When the sound stops, the light stops": silent for half a second, once, and no water lit through it', () => {
    const r = replay(demoTake('off', 50))
    const breaks = r.moments.filter((m) => m.event.type === 'break')
    expect(breaks).toHaveLength(1)
    const moment = breaks[0]
    if (moment.event.type !== 'break') throw new Error('no break')
    expect(moment.event.t).toBeCloseTo(OFF_GAP.from, 1)
    expect(OFF_GAP.to - OFF_GAP.from).toBeCloseTo(0.5, 9)
    const silent = r.frames.filter(
      (f) => f.t >= OFF_GAP.from && f.t < OFF_GAP.to,
    )
    expect(silent.length).toBeGreaterThan(25)
    expect(silent.every((f) => f.voice === null)).toBe(true)
    // Lit just before it (back on the crest on the way down), dark once
    // the gap outlasts the bridge, and lit again when the buzz comes back.
    const before = r.frames.filter(
      (f) => f.t >= OFF_GAP.from - 0.2 && f.t < OFF_GAP.from,
    )
    expect(before.every((f) => f.on)).toBe(true)
    const bridge = DEMO_PRESET.bridgeGapMs / 1000
    const unlit = silent.filter((f) => f.t > OFF_GAP.from + bridge + 0.02)
    expect(unlit.length).toBeGreaterThan(15)
    expect(unlit.every((f) => !f.on)).toBe(true)
    const after = r.frames.find((f) => f.t >= OFF_GAP.to + 0.05)
    expect(after?.on).toBe(true)
  })

  it('"Ride it all the way up and back": take 2 is on the path from its first moment to its last', () => {
    const r = replay(demoTake('on', 50))
    expect(first(r, 'onPath').t).toBeLessThan(0.05)
    expect(r.frames.every((f) => f.on)).toBe(true)
    expect(r.moments.filter((m) => m.event.type === 'offPath')).toEqual([])
  })

  it('"Turn at the top": take 2 reaches the top and holds it before it turns', () => {
    const take = demoTake('on', 50)
    const r = replay(take)
    const top = first(r, 'top')
    const wave = take.plan.path.arches[0]
    expect(top.t).toBeGreaterThan(wave.topStart - 0.1)
    expect(top.t).toBeLessThan(wave.topEnd)
    const there = r.frames.filter(
      (f) => f.t >= wave.topStart + 0.1 && f.t <= wave.topEnd,
    )
    for (const f of there) {
      expect(Math.abs(((f.voice ?? 0) - wave.topMidi) * 100)).toBeLessThan(
        DEMO_PRESET.top?.tolCents ?? 0,
      )
    }
  })

  it('"Your score is how much of the bay you light": the score is the lit share, and take 2 lights it all', () => {
    const r = replay(demoTake('on', 50))
    const end = first(r, 'archEnd').event
    expect(end).toMatchObject({ type: 'archEnd', lit: true })
    if (end.type === 'archEnd') expect(end.coverage).toBeCloseTo(r.coverage, 9)
  })
})

describe("the demo's rules, clocks and voice", () => {
  it("sings at Learning's timing and band, with the top checked so `top` fires", () => {
    expect(DEMO_LEVEL).toBe('learning')
    const { top, ...rest } = DEMO_PRESET
    const { top: beginnerTop, ...beginner } = BEGINNER
    expect(rest).toEqual(beginner)
    expect(beginnerTop).toBeNull()
    expect(top).toEqual(LIP_ROLL_LEVELS.professional.top)
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
    // Silent until the wave starts.
    const before = take.frames.filter((f) => f.t < take.plan.countIn - 1e-9)
    expect(before.every((f) => f.f0 === 0)).toBe(true)
  })

  it("moves at the wave's own pace: up in 2.4 s, at the top for 0.4 s, down in 2.4 s", () => {
    const take = demoTake('on', 50)
    const { countIn, path } = take.plan
    const wave = path.arches[0]
    const parts = [
      wave.topStart - wave.start,
      wave.topEnd - wave.topStart,
      wave.end - wave.topEnd,
    ]
    const level = [BEGINNER.upSec, BEGINNER.topSec, BEGINNER.downSec]
    parts.forEach((part, i) => expect(part).toBeCloseTo(level[i], 9))
    expect(wave.topMidi - wave.rootMidi).toBe(LIP_ROLL_SEMITONES)
    // The buzz reaches the top within a breath of the crest, and leaves it
    // as the crest does. An octave's eased glide is within 30 c of the top
    // for about 0.22 s either side of it, and the buzz trails by 0.08 s.
    const sung = take.voice.filter((p) => p.level > 0)
    const atTop = sung.filter((p) => p.cents > 1170)
    const reach = atTop[0].t - countIn
    const leave = atTop[atTop.length - 1].t - countIn
    expect(reach).toBeGreaterThan(wave.topStart - 0.3)
    expect(reach).toBeLessThan(wave.topStart + 0.15)
    expect(leave).toBeGreaterThan(wave.topEnd - 0.05)
    expect(leave).toBeLessThan(wave.topEnd + 0.35)
    expect(RIDE_LAG_SEC).toBeLessThan(BEGINNER.lagMs / 1000 / 2)
  })

  it('buzzes what the frames carry: the voice follows the frames to the tracker grain', () => {
    for (const id of ['off', 'on'] as const) {
      const take = demoTake(id, 50)
      let worst = 0
      let compared = 0
      const edges = [OFF_GAP.from, OFF_GAP.to].map((s) => s + take.plan.countIn)
      for (const point of take.voice) {
        if (point.level <= 0) continue
        if (edges.some((s) => Math.abs(s - point.t) < 1e-6)) continue
        // The moments a voice point and a frame share (every 50 ms).
        const frame = take.frames.find((f) => Math.abs(f.t - point.t) < 1e-6)
        const cents = frame === undefined ? null : offTarget(frame, 50)
        if (cents === null) continue
        compared += 1
        worst = Math.max(worst, Math.abs(cents - point.cents))
      }
      expect(compared, id).toBeGreaterThan(50)
      // The tracker's grain is in the frames, not the contour.
      expect(worst, id).toBeLessThan(3)
    }
  })

  it('gives every tooltip time to be read before the next takes its place', () => {
    for (const root of ROOTS) {
      const plan = planLipDemo(root)
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

  it("shows each take's moment while its tooltip is up: the dark top, the silence, the turn", () => {
    const plan = planLipDemo(50)
    const at = (id: string): [number, number] => {
      const i = plan.cues.findIndex((c) => c.id === id)
      return [plan.cues[i].at, plan.cues[i + 1]?.at ?? plan.total]
    }
    const off = plan.takes.off
    const on = plan.takes.on
    const wave = off.plan.path.arches[0]
    const wall = (start: number, take: LipDemoTake, tau: number): number =>
      start + take.plan.countIn + tau
    // The dark top passes under the voice while "the top stays dark" is up.
    const [shortOn, shortOff] = at('short')
    expect(shortOn).toBeLessThan(wall(plan.takeStart.off, off, wave.topStart))
    expect(shortOff).toBeGreaterThan(wall(plan.takeStart.off, off, wave.topEnd))
    // The buzz is still silent when "the light stops" shows.
    const [breakOn] = at('break')
    expect(breakOn).toBeLessThan(wall(plan.takeStart.off, off, OFF_GAP.to))
    expect(breakOn).toBeGreaterThan(wall(plan.takeStart.off, off, OFF_GAP.from))
    // The voice turns at the top's end while "Turn at the top." is up.
    const [turnOn, turnOff] = at('turn')
    expect(turnOn).toBeLessThan(wall(plan.takeStart.on, on, wave.topEnd))
    expect(turnOff).toBeGreaterThan(wall(plan.takeStart.on, on, wave.topEnd))
  })

  it('lasts about 22 s, every tooltip inside its take, in order', () => {
    const plan = planLipDemo(50)
    expect(plan.total).toBeGreaterThan(22)
    expect(plan.total).toBeLessThan(22.6)
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

describe("the demo's camera", () => {
  it('follows the voice, then stands with the whole wave on the screen while the tooltips are read', () => {
    const take = demoTake('on', 50)
    const { path, countIn } = take.plan
    const held = holdCamera(createBayScroll(path, countIn), take.hold)
    expect(take.hold).toEqual(DEMO_HOLD)
    const wave = path.arches[0]
    // It stands before the top ends, and the voice rides on.
    expect(DEMO_HOLD.from).toBeGreaterThan(1)
    expect(DEMO_HOLD.to).toBeLessThanOrEqual(wave.topEnd + 0.35)
    // The crest's screen x at the stand: the wave's feet both on the
    // screen (W from the left; the playhead at 0.35), and Merc at the far
    // foot with room for his body (half his canvas, 0.24 W, less its clear
    // edge) inside the screen's right edge.
    const crestOnScreen = 0.35 + (0 - held.camera(path.duration))
    expect(crestOnScreen - 0.4125).toBeGreaterThan(-0.03)
    expect(crestOnScreen + 0.4125).toBeLessThan(0.82)
    const mercAtEnd = 0.35 + held.at(path.duration) - held.camera(path.duration)
    expect(mercAtEnd + 0.24 * 0.5).toBeLessThan(1)
  })
})

describe("the demo's words", () => {
  const words = [
    ...Object.values(DEMO_COPY),
    ...DEMO_CUES.map((cue) => demoCueText(cue.id)),
  ]

  it("say the design's lines: stopping short, the light stopping, the ride, the turn and the score", () => {
    expect(DEMO_CUES.map((cue) => demoCueText(cue.id))).toEqual([
      'Stop short and the top stays dark.',
      'When the sound stops, the light stops.',
      'Ride it all the way up and back.',
      'Turn at the top.',
      'Your score is how much of the bay you light.',
    ])
  })

  it('make no claim about the lips or the buzz: the app hears pitch', () => {
    for (const text of words) expect(text).not.toMatch(/lips|buzz|mouth/iu)
  })

  it('keep out em dashes, "calm" and "practise"', () => {
    for (const text of words) {
      expect(text).not.toMatch(/—/u)
      expect(text).not.toMatch(/calm/iu)
      expect(text).not.toMatch(/practis/iu)
    }
  })
})
