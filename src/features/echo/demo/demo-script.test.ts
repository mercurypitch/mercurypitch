// ============================================================
// The Echo demo's script, replayed through the engine it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through tickSequence and the room's early rule, here
// and not through the script's own pass, at every root the room can offer,
// and check that each moment a tooltip waits for happens exactly once, in
// order, and is what the tooltip says it is.

import { describe, expect, it } from 'vitest'
import { offTarget } from '@/lib/hold/hold-reading'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { MissedNote, NoteOutcome } from '@/lib/sequence/sequence-engine'
import { createSequenceState, ECHO_LEVELS, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import { centsOff, NO_EARLY, watchEarly } from '../early-singing'
import { phraseLine } from '../echo-run'
import { PHRASE_SHOW_MS } from '../useEchoController'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planEchoDemo, } from './demo-cues'
import type { EchoDemoTake } from './demo-script'
import { CALL_AT, DEMO_FAST_RATE, DEMO_LEVEL, DEMO_VIBRATO, demoTake, FLAT_CENTS, RESULT_AFTER, } from './demo-script'

const ROOTS = Array.from(
  { length: HOLD_TARGET_MAX_MIDI - HOLD_TARGET_MIN_MIDI + 1 },
  (_, i) => HOLD_TARGET_MIN_MIDI + i,
)

const pitchOf = (frame: PitchFrame): number | null => {
  const cents = offTarget(frame, 0)
  return cents === null ? null : cents / 100
}

interface Replay {
  /** Every moment, in order, with its engine time. */
  marks: { type: string; at: number }[]
  outcomes: readonly NoteOutcome[]
  /** The engine's state after the last frame before the response opened. */
  beforeResponse: ReturnType<typeof createSequenceState>
}

/** A take's frames through the room's early rule and the engine, afresh. */
function replay(take: EchoDemoTake): Replay {
  const rules = ECHO_LEVELS[DEMO_LEVEL]
  let state = createSequenceState(take.callEnd + RESPONSE_GATE_SECONDS)
  let early = NO_EARLY
  let previous: PitchFrame | null = null
  let beforeResponse = state
  const marks: { type: string; at: number }[] = [{ type: 'call', at: CALL_AT }]
  for (const frame of take.frames) {
    if (state.ended) break
    const fired = early.fired
    early = watchEarly(early, frame, previous, pitchOf(frame), take.call)
    if (early.fired && !fired) marks.push({ type: 'early', at: frame.t })
    previous = frame
    state = tickSequence(state, frame, take.phrase, rules)
    if (frame.t < state.responseStart - 1e-6) beforeResponse = state
    for (const event of state.events) {
      marks.push({
        type:
          event.type === 'phraseEnd'
            ? 'phraseEnd'
            : `${event.type}:${event.index}`,
        at: frame.t,
      })
    }
  }
  return { marks, outcomes: state.outcomes, beforeResponse }
}

const types = (r: Replay): string[] => r.marks.map((m) => m.type)

describe("the demo's takes, at every root the room offers", () => {
  it('take 1 comes in early, lands the first note, misses the second and the third', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('off', root))
      expect(types(r), `root ${root}`).toEqual([
        'call',
        'early',
        'land:0',
        'miss:1',
        'miss:2',
        'phraseEnd',
      ])
    }
  })

  it('take 2 waits for the call and lands all three notes', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('on', root))
      expect(types(r), `root ${root}`).toEqual([
        'call',
        'land:0',
        'land:1',
        'land:2',
        'phraseEnd',
      ])
    }
  })

  it("matches the takes' own events, which the room and the plan run on", () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 57, HOLD_TARGET_MAX_MIDI]) {
      for (const id of ['off', 'on'] as const) {
        const take = demoTake(id, root)
        const r = replay(take)
        const own = take.events.filter((event) => event.type !== 'result')
        expect(own).toEqual(r.marks)
      }
    }
  })

  it('is the same take every time for the same root', () => {
    for (const id of ['off', 'on'] as const) {
      const [a, b] = [demoTake(id, 57), demoTake(id, 57)]
      expect([a.frames, a.events, a.voice, a.fast, a.length]).toEqual([
        b.frames,
        b.events,
        b.voice,
        b.fast,
        b.length,
      ])
    }
  })
})

describe('what each tooltip says is what happened', () => {
  it('"Too early": the voice sounds over the last note, and the engine ignores it', () => {
    for (const root of ROOTS) {
      const take = demoTake('off', root)
      const r = replay(take)
      const early = r.marks.find((m) => m.type === 'early')?.at ?? NaN
      const last = take.call[take.call.length - 1]
      expect(early).toBeGreaterThan(last.from)
      expect(early).toBeLessThan(last.to)
      // Nothing the engine heard before the response opened counted.
      expect(r.beforeResponse.events).toEqual([])
      expect(r.beforeResponse.current).toBe(0)
      expect(r.beforeResponse.lastVoicedAt).toBeNull()
    }
  })

  it('"Flat": the second note sat flat, by more than the band, to its deadline', () => {
    const rules = ECHO_LEVELS[DEMO_LEVEL]
    for (const root of ROOTS) {
      const r = replay(demoTake('off', root))
      const second = r.outcomes[1] as MissedNote
      expect(second.landed).toBe(false)
      expect(second.cause).toBe('deadline')
      expect(second.closest?.cents).toBeLessThan(-rules.tolCents)
      expect(second.closest?.cents).toBeGreaterThan(FLAT_CENTS - 15)
      // And the room's own line about the phrase says the same.
      const take = demoTake('off', root)
      expect(
        phraseLine(
          { phrase: take.phrase, outcomes: r.outcomes },
          rules.tolCents,
        ),
      ).toEqual({
        moment: 'flatNote',
        fields: { nth: 'second' },
      })
    }
  })

  it('"Slid past it": the voice crosses the third note too fast to land, then stops', () => {
    const rules = ECHO_LEVELS[DEMO_LEVEL]
    for (const root of ROOTS) {
      const take = demoTake('off', root)
      const r = replay(take)
      const third = r.outcomes[2] as MissedNote
      expect(third.landed).toBe(false)
      expect(third.cause).toBe('silence')
      expect(third.closest).toBeNull()
      // It was heard, briefly, inside the third note's band.
      const missed = r.marks.find((m) => m.type === 'miss:1')?.at ?? NaN
      const inBand = take.frames.filter((frame) => {
        const pitch = pitchOf(frame)
        return (
          frame.t > missed &&
          pitch !== null &&
          Math.abs(centsOff(pitch, take.phrase.notes[2].midi, false)) <=
            rules.tolCents
        )
      })
      expect(inBand.length).toBeGreaterThan(0)
      expect(inBand.length / 60).toBeLessThan(rules.landMs / 1000 / 2)
    }
  })

  it('"On the note": take 2 lands every note near its centre', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('on', root))
      for (const outcome of r.outcomes) {
        expect(outcome.landed).toBe(true)
        if (outcome.landed) expect(Math.abs(outcome.cents)).toBeLessThan(15)
      }
      const take = demoTake('on', root)
      expect(
        phraseLine({ phrase: take.phrase, outcomes: r.outcomes }, 50).moment,
      ).toBe('phraseAll')
    }
  })

  it('"Each note you land counts": the result follows the phrase as the room shows it', () => {
    expect(RESULT_AFTER).toBe(PHRASE_SHOW_MS / 1000)
    const take = demoTake('on', 57)
    const end = take.events.find((e) => e.type === 'phraseEnd')?.at ?? NaN
    const result = take.events.find((e) => e.type === 'result')?.at ?? NaN
    expect(result - end).toBeCloseTo(RESULT_AFTER, 9)
  })
})

describe("the demo's clocks and voice", () => {
  it("fast-forwards only take 1's wait on the flat note, at 4x", () => {
    const take = demoTake('off', 57)
    const r = replay(take)
    const landed = r.marks.find((m) => m.type === 'land:0')?.at ?? NaN
    const missed = r.marks.find((m) => m.type === 'miss:1')?.at ?? NaN
    expect(take.fast).toHaveLength(1)
    expect(take.fast[0].from).toBeGreaterThan(landed + 0.3)
    expect(take.fast[0].to).toBeLessThan(missed)
    expect(DEMO_FAST_RATE).toBe(4)
    expect(demoTake('on', 57).fast).toEqual([])
    // The wall clock and the engine's agree but for the stretch.
    expect(take.wallAt(take.fast[0].from)).toBeCloseTo(take.fast[0].from, 9)
    const saved = (take.fast[0].to - take.fast[0].from) * (1 - 1 / 4)
    expect(take.wallAt(missed)).toBeCloseTo(missed - saved, 9)
    expect(take.engineAt(take.wallAt(missed))).toBeCloseTo(missed, 9)
  })

  it('sings what the frames carry: the voice follows the frames to within the vibrato', () => {
    for (const id of ['off', 'on'] as const) {
      const take = demoTake(id, 57)
      let worst = 0
      for (const point of take.voice) {
        if (point.level <= 0) continue
        const e = take.engineAt(point.t)
        const frame = take.frames.find((f) => f.t >= e - 1e-9)
        const pitch = frame === undefined ? null : pitchOf(frame)
        if (pitch === null) continue
        worst = Math.max(worst, Math.abs((pitch - 57) * 100 - point.cents))
      }
      // Vibrato and the tracker's grain are in the frames, not the contour;
      // a glide moves this far between a voice point and the next frame.
      expect(worst, id).toBeLessThan(DEMO_VIBRATO.cents + 40)
    }
  })

  it('lasts about 17 s, every tooltip inside its take, in order', () => {
    const plan = planEchoDemo(57)
    expect(plan.total).toBeGreaterThan(15.5)
    expect(plan.total).toBeLessThan(18.5)
    const order = plan.cues.map((cue) => cue.id)
    expect(order).toEqual(DEMO_CUES.map((cue) => cue.id))
    const ats = plan.cues.map((cue) => cue.at)
    expect([...ats].sort((a, b) => a - b)).toEqual(ats)
    const offEnd = plan.takeStart.off + plan.takes.off.length
    const onStart = plan.takeStart.on
    for (const cue of plan.cues) {
      const take = DEMO_CUES.find((c) => c.id === cue.id)?.trigger.take
      if (take === 'off') {
        expect(cue.at).toBeLessThan(offEnd + DEMO_BEATS.afterOff)
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

  it('say flat, on the note and the fix, plainly', () => {
    expect(demoCueText('flat')).toMatch(/flat/iu)
    expect(demoCueText('flat')).toMatch(/higher/iu)
    expect(demoCueText('lands')).toMatch(/on the note/iu)
    expect(demoCueText('slid')).toMatch(/stop on each note/iu)
  })

  it('keep out em dashes, "calm" and "practise"', () => {
    for (const text of words) {
      expect(text).not.toMatch(/—/u)
      expect(text).not.toMatch(/calm/iu)
      expect(text).not.toMatch(/practis/iu)
    }
  })
})
