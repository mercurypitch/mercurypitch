// ============================================================
// The Leap demo's script, replayed through the engine it teaches
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
import { leapOutcome, leapPhrase } from '../leap-phrase'
import { AUDIBLE_HIGH, AUDIBLE_LOW } from '../leap-round'
import { leapName, leapSong, SOUND_LEAD_SECONDS } from '../leap-rules'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLeapDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { LeapDemoTake } from './demo-script'
import { CALL_AT, DEMO_LEAP, DEMO_RULES, demoRound, demoTake, SHORT_CENTS, } from './demo-script'

/** Every note a singer's window can have for its middle. */
const NOTES = Array.from(
  { length: AUDIBLE_HIGH - AUDIBLE_LOW + 1 },
  (_, i) => AUDIBLE_LOW + i,
)

interface Replay {
  /** Every moment, in order, with its engine time. */
  marks: { type: string; at: number }[]
  outcome: ReturnType<typeof leapOutcome>
}

/** A take's frames through the engine afresh, as the room hears them. */
function replay(take: LeapDemoTake): Replay {
  let state = createSequenceState(take.responseStart)
  const phrase = leapPhrase(take.round)
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
      if (event.type === 'phraseEnd' || event.index === 1) {
        const outcome = leapOutcome(state, take.round, {
          voiced: true,
          heardAgain: false,
        })
        if (outcome !== null) {
          marks.push({ type: 'outcome', at: frame.t })
          return { marks, outcome }
        }
      }
    }
  }
  return { marks, outcome: null }
}

const types = (r: Replay): string[] => r.marks.map((m) => m.type)

describe("the Leap demo's takes", () => {
  it('leaps a fifth up, in the audible band, its middle on the note', () => {
    for (const note of NOTES) {
      const round = demoRound(note)
      expect(round.to - round.from).toBe(7)
      expect(round.from).toBeGreaterThanOrEqual(AUDIBLE_LOW)
      expect(round.to).toBeLessThanOrEqual(AUDIBLE_HIGH)
    }
    expect(demoRound(60)).toMatchObject({ from: 57, to: 64 })
    expect(leapName(DEMO_LEAP)).toBe('Up a fifth')
    expect(leapSong(DEMO_LEAP)?.short).toBe('Twinkle, Twinkle')
  })

  it('has Merc sing his note alone at Singer, the turn opening after it', () => {
    const take = demoTake('off', 60)
    expect(DEMO_RULES.mercSingsBoth).toBe(false)
    expect(take.call.map((n) => n.midi)).toEqual([take.round.from])
    expect(take.call[0].at).toBe(CALL_AT)
    const end = take.call[0].at + take.call[0].seconds
    expect(take.responseStart).toBeGreaterThan(end)
  })

  it.each(NOTES)(
    'take 1 at %i: his note, then a leap short of the band; the lantern stays dark',
    (note) => {
      const take = demoTake('off', note)
      const heard = replay(take)
      // As the room reports them, and as the script itself saw them.
      expect(types(heard)).toEqual(['call', 'land:0', 'miss:1', 'outcome'])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.landed).toBe(false)
      // Short: what the tooltip says, the voice sitting under the target.
      expect(heard.outcome).toMatchObject({ landed: false, short: true })
      const held = take.frames
        .filter((f) => f.t > take.length - 2.5 && f.t < take.length - 2.2)
        .map((f) => offTarget(f, take.round.to))
      expect(held.length).toBeGreaterThan(0)
      for (const cents of held) {
        if (cents === null) continue
        expect(cents).toBeLessThan(-DEMO_RULES.tolCents)
        expect(cents).toBeGreaterThan(SHORT_CENTS - 30)
      }
    },
  )

  it.each(NOTES)(
    'take 2 at %i: his note, then the leap into the band, held: it lands',
    (note) => {
      const take = demoTake('on', note)
      const heard = replay(take)
      expect(types(heard)).toEqual(['call', 'land:0', 'land:1', 'outcome'])
      expect(take.events.map((e) => e.type)).toEqual(types(heard))
      expect(take.landed).toBe(true)
      expect(heard.outcome?.landed).toBe(true)
      expect(Math.abs(heard.outcome?.cents ?? 99)).toBeLessThanOrEqual(
        DEMO_RULES.tolCents,
      )
      expect(take.answer).toEqual([])
    },
  )

  it("has Merc sing both notes after take 1's miss, as a run's answer starts", () => {
    const take = demoTake('off', 60)
    expect(take.answer.map((n) => n.midi)).toEqual([
      take.round.from,
      take.round.to,
    ])
    expect(take.answer[0].at).toBeCloseTo(take.length + SOUND_LEAD_SECONDS, 6)
  })

  it('plays the same frames for the same note', () => {
    expect(demoTake('off', 62).frames).toEqual(demoTake('off', 62).frames)
    expect(demoTake('on', 62).voice).toEqual(demoTake('on', 62).voice)
  })
})

describe("the Leap demo's plan", () => {
  it.each(NOTES)(
    'at %i gives every tooltip its read, in order, before the take moves on',
    (note) => {
      const plan = planLeapDemo(note)
      expect(plan.cues.map((c) => c.id)).toEqual([
        'call',
        'leap',
        'short',
        'lands',
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

  it('shows "leap" while the voice still holds his note, before it leaps', () => {
    const plan = planLeapDemo(60)
    const take = plan.takes.off
    const leap = plan.cues.find((c) => c.id === 'leap')
    // The voice leaves his note: the first frame a semitone off it.
    const leaves = take.frames.find((f) => {
      const cents = offTarget(f, take.round.from)
      return f.t > take.responseStart + 0.5 && cents !== null && cents > 100
    })
    expect(leaves).toBeDefined()
    expect(leap?.at).toBeLessThan(plan.takeStart.off + (leaves?.t ?? 0))
  })

  it("lets Merc's answer finish before the room empties", () => {
    const plan = planLeapDemo(60)
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
