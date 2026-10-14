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
import { DEMO_PHRASE_SHOW_MS, PHRASE_SHOW_MS, } from '../echo-controller-contract'
import { phraseLine } from '../echo-run'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planEchoDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { DemoVoicePoint, EchoDemoTake } from './demo-script'
import { CALL_AT, DEMO_LEVEL, DEMO_VIBRATO, demoTake, ECHO_GLIDE_SECONDS, ECHO_NOTE_SECONDS, FLAT_CENTS, FLAT_NOTES, RESULT_AFTER, } from './demo-script'

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

/** The phrase's notes above its root, cents. */
const centsAbove = (take: EchoDemoTake): number[] =>
  take.phrase.notes.map((note) => (note.midi - take.root) * 100)

/**
 * How long the voice holds each of `targets` (cents above the root), in
 * order: a note is left once the voice has reached it and is nearer the
 * next, so a glide counts half to the note it leaves and half to the next.
 */
function sungNotes(
  voice: readonly DemoVoicePoint[],
  targets: readonly number[],
): number[] {
  const seconds = targets.map(() => 0)
  let at = 0
  let reached = false
  for (const [i, point] of voice.entries()) {
    if (i === 0 || point.level <= 0) continue
    const off = (k: number): number => Math.abs(point.cents - targets[k])
    if (reached && at + 1 < targets.length && off(at + 1) < off(at)) {
      at += 1
      reached = false
    }
    if (off(at) < 50) reached = true
    seconds[at] += point.t - voice[i - 1].t
  }
  return seconds
}

describe("the demo's takes, at every root the room offers", () => {
  it('take 1 comes in early, lands the first note, misses the second and lands the third', () => {
    for (const root of ROOTS) {
      const r = replay(demoTake('off', root))
      expect(types(r), `root ${root}`).toEqual([
        'call',
        'early',
        'land:0',
        'miss:1',
        'land:2',
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

  it('"Flat": the second note sat flat, by more than the band, until the voice moved on and landed the third', () => {
    const rules = ECHO_LEVELS[DEMO_LEVEL]
    for (const root of ROOTS) {
      const r = replay(demoTake('off', root))
      const second = r.outcomes[1] as MissedNote
      expect(second.landed).toBe(false)
      // The engine's own rule: a pending note misses when the voice lands
      // the next one, long before its deadline.
      expect(second.cause).toBe('skipped')
      const at = (type: string) => r.marks.find((m) => m.type === type)?.at
      expect(at('miss:1')).toBe(at('land:2'))
      expect(r.outcomes[2].landed).toBe(true)
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

  it('"Flat": the flat note is heard, steady, for longer than a note of the call', () => {
    const take = demoTake('off', 57)
    const second = take.phrase.notes[1].midi
    const flat = take.frames.filter((frame) => {
      const pitch = pitchOf(frame)
      if (pitch === null) return false
      const off = centsOff(pitch, second, false)
      return Math.abs(off - FLAT_CENTS) <= 20
    })
    const seconds = flat.length / 60
    expect(seconds).toBeGreaterThan(ECHO_NOTE_SECONDS)
    expect(seconds).toBeLessThan(FLAT_NOTES * ECHO_NOTE_SECONDS + 0.05)
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
    expect(RESULT_AFTER).toBe(DEMO_PHRASE_SHOW_MS / 1000)
    // The demo holds the phrase a little longer than a run, never less.
    expect(DEMO_PHRASE_SHOW_MS).toBeGreaterThanOrEqual(PHRASE_SHOW_MS)
    const take = demoTake('on', 57)
    const end = take.events.find((e) => e.type === 'phraseEnd')?.at ?? NaN
    const result = take.events.find((e) => e.type === 'result')?.at ?? NaN
    expect(result - end).toBeCloseTo(RESULT_AFTER, 9)
  })
})

describe("the demo's clocks and voice", () => {
  it('plays every take at its own speed: no fast-forward, one clock', () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 57, HOLD_TARGET_MAX_MIDI]) {
      for (const id of ['off', 'on'] as const) {
        const take = demoTake(id, root)
        expect(take.fast, `${id} ${root}`).toEqual([])
        for (const event of take.events) {
          expect(take.wallAt(event.at)).toBe(event.at)
          expect(take.engineAt(event.at)).toBe(event.at)
        }
        const end = take.events.find((e) => e.type === 'phraseEnd')?.at
        expect(take.length).toBe(end)
      }
    }
    expect(DEMO_COPY).not.toHaveProperty('fast')
  })

  it("sings take 2 back at the call's pace: each note as long as Merc's", () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 57, HOLD_TARGET_MAX_MIDI]) {
      const take = demoTake('on', root)
      const sung = sungNotes(take.voice, centsAbove(take))
      expect(ECHO_NOTE_SECONDS).toBe(take.rules.noteSeconds)
      expect(sung).toHaveLength(3)
      for (const [i, seconds] of sung.entries()) {
        const call = take.phrase.notes[i].seconds
        expect(seconds, `root ${root} note ${i}`).toBeGreaterThan(call - 0.08)
        expect(seconds, `root ${root} note ${i}`).toBeLessThan(call + 0.08)
      }
    }
    // An unhurried move between notes, not a jump.
    expect(ECHO_GLIDE_SECONDS).toBeGreaterThanOrEqual(0.15)
  })

  it("sings take 1's in-tune notes at the call's pace too, and holds the flat one longer", () => {
    const take = demoTake('off', 57)
    const [first, second, third] = centsAbove(take)
    const sung = sungNotes(take.voice, [first, second + FLAT_CENTS, third])
    // The first came in early, over the call: longer than a note.
    expect(sung[0]).toBeGreaterThan(ECHO_NOTE_SECONDS)
    expect(sung[1]).toBeCloseTo(FLAT_NOTES * ECHO_NOTE_SECONDS, 1)
    expect(sung[2]).toBeCloseTo(ECHO_NOTE_SECONDS, 1)
  })

  it('sings what the frames carry: the voice follows the frames to within the vibrato', () => {
    for (const id of ['off', 'on'] as const) {
      const take = demoTake(id, 57)
      let worst = 0
      for (const point of take.voice) {
        if (point.level <= 0) continue
        const e = point.t
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

  it('gives every tooltip time to be read before the next takes its place', () => {
    for (const root of [HOLD_TARGET_MIN_MIDI, 57, HOLD_TARGET_MAX_MIDI]) {
      const plan = planEchoDemo(root)
      const offOver =
        plan.takeStart.off + plan.takes.off.length + DEMO_BEATS.afterOff
      const result =
        plan.takeStart.on +
        (plan.takes.on.events.find((e) => e.type === 'result')?.at ?? NaN)
      plan.cues.forEach((cue, i) => {
        const take = DEMO_CUES[i].trigger.take
        // Up until the next tooltip, the reset after take 1, the result
        // (which takes the phrase's tooltip down) or the end card.
        const ends = [
          plan.cues[i + 1]?.at ?? plan.total,
          take === 'off' ? offOver : plan.total,
          cue.at < result ? result : plan.total,
        ]
        const up = Math.min(...ends) - cue.at
        expect(up, `${cue.id} at root ${root}`).toBeGreaterThanOrEqual(
          TIP_READ_SECONDS,
        )
      })
    }
  })

  it('lasts about 19 s, every tooltip inside its take, in order', () => {
    const plan = planEchoDemo(57)
    expect(plan.total).toBeGreaterThan(18.5)
    expect(plan.total).toBeLessThan(19.5)
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
  })

  it('keep out em dashes, "calm" and "practise"', () => {
    for (const text of words) {
      expect(text).not.toMatch(/—/u)
      expect(text).not.toMatch(/calm/iu)
      expect(text).not.toMatch(/practis/iu)
    }
  })
})
