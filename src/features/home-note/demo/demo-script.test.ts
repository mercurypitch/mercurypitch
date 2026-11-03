// ============================================================
// The Home note demo's script, replayed through the engine it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through tickSequence, here and not through the
// script's own pass, at every key the room can offer, and check that each
// moment a tooltip waits for happens exactly once, in order, and is what
// the tooltip says it is; and that the plan gives every tooltip its read.

import { describe, expect, it } from 'vitest'
import { offTarget } from '@/lib/hold/hold-reading'
import { createSequenceState, tickSequence, } from '@/lib/sequence/sequence-engine'
import { ANSWER_DELAY } from '../home-note-band'
import { AUDIBLE_HIGH, AUDIBLE_LOW } from '../home-note-round'
import { CHORD_SECONDS, SOUND_LEAD_SECONDS } from '../home-note-rules'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planHomeNoteDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { HomeNoteDemoTake } from './demo-script'
import { DEMO_RULES, demoRound, demoTake, FIFTH_CENTS, homePhrase, INTRO_AT, } from './demo-script'

/** Every key the room can offer, by its home. */
const NOTES = Array.from(
  { length: AUDIBLE_HIGH - AUDIBLE_LOW + 1 },
  (_, i) => AUDIBLE_LOW + i,
)

interface Replay {
  /** Every moment, in order, with its engine time. */
  marks: { type: string; at: number }[]
  landed: boolean | null
}

/** A take's frames through the engine afresh, as the room hears them. */
function replay(take: HomeNoteDemoTake): Replay {
  let state = createSequenceState(take.responseStart)
  const phrase = homePhrase(take.round)
  const marks: { type: string; at: number }[] = [
    { type: 'band', at: INTRO_AT },
    { type: 'turn', at: take.responseStart },
  ]
  for (const frame of take.frames) {
    if (frame.t < take.responseStart) continue
    state = tickSequence(state, frame, phrase, DEMO_RULES)
    for (const event of state.events) {
      if (event.type === 'phraseEnd') {
        marks.push({ type: 'phraseEnd', at: frame.t })
        continue
      }
      marks.push({ type: `${event.type}:${event.index}`, at: frame.t })
      const outcome = state.outcomes[event.index]
      if (outcome !== undefined) {
        marks.push({ type: 'outcome', at: frame.t })
        return { marks, landed: outcome.landed }
      }
    }
  }
  return { marks, landed: null }
}

const types = (r: Replay): string[] => r.marks.map((m) => m.type)

describe("the Home note demo's takes", () => {
  it("plays home on the room's note, where a phone carries it", () => {
    expect(demoRound(60)).toEqual({ index: 0, home: 60 })
    expect(demoRound(61.6)).toEqual({ index: 0, home: 62 })
    expect(demoRound(30).home).toBe(AUDIBLE_LOW)
    expect(demoRound(90).home).toBe(AUDIBLE_HIGH)
  })

  it('plays the band at Singer, I IV V and no one singing home, the turn opening after it', () => {
    const take = demoTake('off', 60)
    expect(DEMO_RULES.intro).toEqual(['I', 'IV', 'V'])
    expect(DEMO_RULES.mercSingsHome).toBe(false)
    expect(take.introAt).toBe(INTRO_AT)
    expect(take.responseStart).toBeGreaterThan(
      INTRO_AT + DEMO_RULES.intro.length * CHORD_SECONDS,
    )
  })

  it.each(NOTES)(
    "take 1 in the key of %i: the last chord's note held and let go: no home",
    (note) => {
      const take = demoTake('off', note)
      const heard = replay(take)
      // As the room reports them, and as the script itself saw them.
      expect(types(heard)).toEqual(['band', 'turn', 'miss:0', 'outcome'])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.landed).toBe(false)
      expect(heard.landed).toBe(false)
      // The fifth under home, not home: what the tooltip says.
      const fifth = take.frames
        .map((f) => offTarget(f, take.round.home + FIFTH_CENTS / 100))
        .filter((cents): cents is number => cents !== null)
        .filter((cents) => Math.abs(cents) <= 30)
      expect(fifth.length).toBeGreaterThan(30)
    },
  )

  it.each(NOTES)(
    'take 2 in the key of %i: home, held: the lamp lights',
    (note) => {
      const take = demoTake('on', note)
      const heard = replay(take)
      expect(types(heard)).toEqual(['band', 'turn', 'land:0', 'outcome'])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.landed).toBe(true)
      expect(heard.landed).toBe(true)
      expect(take.answer).toEqual([])
    },
  )

  it("has Merc sing home over home's chord after take 1's miss, as a run's answer comes", () => {
    const take = demoTake('off', 60)
    expect(take.resolveAt).toBeCloseTo(take.length + SOUND_LEAD_SECONDS, 6)
    expect(take.answer).toHaveLength(1)
    expect(take.answer[0].midi).toBe(take.round.home)
    expect(take.answer[0].at).toBeCloseTo(take.resolveAt + ANSWER_DELAY, 6)
  })

  it('plays the same frames for the same note', () => {
    expect(demoTake('off', 62).frames).toEqual(demoTake('off', 62).frames)
    expect(demoTake('on', 62).voice).toEqual(demoTake('on', 62).voice)
  })
})

describe("the Home note demo's plan", () => {
  it.each(NOTES)(
    'in the key of %i gives every tooltip its read, in order, before the take moves on',
    (note) => {
      const plan = planHomeNoteDemo(note)
      expect(plan.cues.map((c) => c.id)).toEqual([
        'band',
        'turn',
        'chord',
        'home',
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

  it('shows "the band plays" while its chords still sound', () => {
    const plan = planHomeNoteDemo(60)
    const band = plan.cues.find((c) => c.id === 'band')
    const lastChordEnds =
      plan.takeStart.off + INTRO_AT + DEMO_RULES.intro.length * CHORD_SECONDS
    expect(band?.at).toBeLessThan(lastChordEnds)
  })

  it("lets Merc's home finish before the room empties", () => {
    const plan = planHomeNoteDemo(60)
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
