// ============================================================
// The Harmony demo's script, replayed through the engine it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through tickSequence, here and not through the
// script's own pass, at every note the room can offer, and check that each
// moment a tooltip waits for happens exactly once, in order, and is what
// the tooltip says it is; and that the plan gives every tooltip its read.

import { describe, expect, it } from 'vitest'
import { offTarget } from '@/lib/hold/hold-reading'
import { createSequenceState, tickSequence, } from '@/lib/sequence/sequence-engine'
import { SUNG_HIGH, SUNG_LOW } from '@/lib/sequence/sung-window'
import { harmonyPhrase, lineOutcome } from '../harmony-phrase'
import { SOUND_LEAD_SECONDS } from '../harmony-rules'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planHarmonyDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { HarmonyDemoTake } from './demo-script'
import { CALL_AT, DEMO_RULES, demoLine, demoTake, MISSED_NOTE, } from './demo-script'

/** Every note a singer's window can have for its middle. */
const NOTES = Array.from(
  { length: SUNG_HIGH - SUNG_LOW + 1 },
  (_, i) => SUNG_LOW + i,
)

interface Replay {
  /** Every moment, in order, with its engine time. */
  marks: { type: string; at: number }[]
  outcome: ReturnType<typeof lineOutcome>
}

/** A take's frames through the engine afresh, as the room hears them. */
function replay(take: HarmonyDemoTake): Replay {
  let state = createSequenceState(take.responseStart)
  const phrase = harmonyPhrase(take.line, DEMO_RULES)
  const marks: { type: string; at: number }[] = [{ type: 'call', at: CALL_AT }]
  for (const frame of take.frames) {
    if (frame.t < take.responseStart) continue
    state = tickSequence(state, frame, phrase, DEMO_RULES)
    for (const event of state.events) {
      const type =
        event.type === 'phraseEnd'
          ? 'phraseEnd'
          : `${event.type}:${event.index}`
      marks.push({ type, at: frame.t })
    }
    const outcome = lineOutcome(state, take.line, {
      voiced: true,
      heardAgain: false,
    })
    if (outcome !== null) {
      marks.push({ type: 'outcome', at: frame.t })
      return { marks, outcome }
    }
  }
  return { marks, outcome: null }
}

const types = (r: Replay): string[] => r.marks.map((m) => m.type)

describe("the Harmony demo's takes", () => {
  it("sings G A B under B C D in a key of the note's, the harmony's middle on it, in the band", () => {
    expect(demoLine(60)).toMatchObject({
      tonic: 48,
      merc: [55, 57, 59],
      harmony: [59, 60, 62],
      below: false,
    })
    for (const note of NOTES) {
      const line = demoLine(note)
      line.harmony.forEach((midi, i) => {
        expect(midi).toBeGreaterThanOrEqual(SUNG_LOW)
        expect(midi).toBeLessThanOrEqual(SUNG_HIGH)
        expect([3, 4]).toContain(midi - line.merc[i])
      })
    }
  })

  it('has Merc sing his line alone at Singer, the turn opening after it', () => {
    const take = demoTake('off', 60)
    expect(DEMO_RULES.mercSingsBoth).toBe(false)
    expect(DEMO_RULES.showsHarmony).toBe(true)
    expect(take.call.map((n) => n.midi)).toEqual(take.line.merc)
    expect(take.call[0].at).toBe(CALL_AT)
    const last = take.call[take.call.length - 1]
    expect(take.responseStart).toBeGreaterThan(last.at + last.seconds)
  })

  it.each(NOTES)(
    "take 1 at %i: the first note a third above, then Merc's own note: that lamp misses",
    (note) => {
      const take = demoTake('off', note)
      const heard = replay(take)
      // As the room reports them, and as the script itself saw them.
      expect(types(heard)).toEqual([
        'call',
        'land:0',
        `miss:${MISSED_NOTE}`,
        `miss:${MISSED_NOTE + 1}`,
        'phraseEnd',
        'outcome',
      ])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.inHarmony).toBe(false)
      expect(heard.outcome).toMatchObject({
        inHarmony: false,
        firstMiss: MISSED_NOTE,
      })
      // His note, not the third over it: what the tooltip says.
      const his = take.frames
        .map((f) => offTarget(f, take.line.merc[MISSED_NOTE]))
        .filter((cents): cents is number => cents !== null)
        .filter((cents) => Math.abs(cents) <= 30)
      expect(his.length).toBeGreaterThan(30)
    },
  )

  it.each(NOTES)(
    'take 2 at %i: every note a third above, held: every lamp lights',
    (note) => {
      const take = demoTake('on', note)
      const heard = replay(take)
      expect(types(heard)).toEqual([
        'call',
        'land:0',
        'land:1',
        'land:2',
        'phraseEnd',
        'outcome',
      ])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.inHarmony).toBe(true)
      expect(heard.outcome?.inHarmony).toBe(true)
      expect(take.answer).toEqual([])
    },
  )

  it("has Merc sing his note, then the third from it, after take 1's miss, as a run's answer starts", () => {
    const take = demoTake('off', 60)
    expect(take.answer.map((n) => n.midi)).toEqual([
      take.line.merc[MISSED_NOTE],
      take.line.harmony[MISSED_NOTE],
    ])
    expect(take.answer[0].at).toBeCloseTo(take.length + SOUND_LEAD_SECONDS, 6)
  })

  it('plays the same frames for the same note', () => {
    expect(demoTake('off', 62).frames).toEqual(demoTake('off', 62).frames)
    expect(demoTake('on', 62).voice).toEqual(demoTake('on', 62).voice)
  })
})

describe("the Harmony demo's plan", () => {
  it.each(NOTES)(
    'at %i gives every tooltip its read, in order, before the take moves on',
    (note) => {
      const plan = planHarmonyDemo(note)
      expect(plan.cues.map((c) => c.id)).toEqual([
        'call',
        'yours',
        'unison',
        'harmony',
      ])
      const offEnd = plan.takeStart.off + plan.takes.off.length
      const onEnd = plan.takeStart.on + plan.takes.on.length
      /** When each tooltip is replaced, or its take moves on. */
      const gone = [
        plan.cues[1].at,
        plan.cues[2].at,
        offEnd + DEMO_BEATS.afterOff,
        onEnd + DEMO_BEATS.afterOn,
      ]
      plan.cues.forEach((cue, i) => {
        expect(gone[i] - cue.at).toBeGreaterThanOrEqual(TIP_READ_SECONDS)
      })
    },
  )

  it('shows "yours" while the voice still holds the first gold note, before it moves', () => {
    const plan = planHarmonyDemo(60)
    const take = plan.takes.off
    const yours = plan.cues.find((c) => c.id === 'yours')
    // The voice leaves the first note: the first frame a semitone off it.
    const leaves = take.frames.find((f) => {
      const cents = offTarget(f, take.line.harmony[0])
      return (
        f.t > take.responseStart + 0.5 &&
        cents !== null &&
        Math.abs(cents) > 100
      )
    })
    expect(leaves).toBeDefined()
    expect(yours?.at).toBeLessThan(plan.takeStart.off + (leaves?.t ?? 0))
  })

  it("lets Merc's pair finish before the room empties", () => {
    const plan = planHarmonyDemo(60)
    const take = plan.takes.off
    const last = take.answer[take.answer.length - 1]
    expect(last.at + last.seconds).toBeLessThan(
      take.length + DEMO_BEATS.afterOff,
    )
  })

  it('says each tooltip in a sentence or two, with no em dash', () => {
    for (const cue of DEMO_CUES) {
      const text = demoCueText(cue.id)
      expect(text).toMatch(/\.$/u)
      expect(text).not.toMatch(/—/u)
    }
    expect(DEMO_COPY.off).toBe('Not like this')
  })
})
