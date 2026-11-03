// ============================================================
// The First note demo's script, replayed through the ears it teaches
// ============================================================
//
// Every tooltip says what a moment of a take means. These tests replay
// each take's frames through the room's own entry rule and tickSequence,
// here and not through the script's own pass, and check that each moment a
// tooltip waits for happens exactly once, in order, and is what the
// tooltip says it is; and that the plan gives every tooltip its read.

import { describe, expect, it } from 'vitest'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { offTarget } from '@/lib/hold/hold-reading'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import { entryHeardIn, entryPhrase } from '../first-note-ears'
import type { EntryHeard } from '../first-note-machine'
import { FIRST_NOTE_LEVELS, MERC_NOTE_SECONDS } from '../first-note-rules'
import { entryPitch, FIRST_NOTE_SONGS } from '../first-note-songs'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planFirstNoteDemo, TIP_READ_SECONDS, } from './demo-cues'
import type { FirstNoteDemoTake } from './demo-script'
import { DEMO_LEVEL, DEMO_RULES, DEMO_SLUG, demoEntry, demoRound, demoTake, INTRO_AT, leadInSeconds, STEP_UNDER_CENTS, } from './demo-script'

interface Replay {
  /** Every moment, in order, with its engine time. */
  marks: { type: string; at: number }[]
  entry: EntryHeard | null
  landed: boolean | null
}

/** A take's frames through the room's ears afresh, as the room hears them. */
function replay(take: FirstNoteDemoTake): Replay {
  let state = createSequenceState(take.responseStart)
  const phrase = entryPhrase(take.round)
  const target = entryPitch(take.round.entry)
  const heard: PitchPoint[] = []
  let entry: EntryHeard | null = null
  const marks: { type: string; at: number }[] = [
    { type: 'band', at: INTRO_AT },
    { type: 'turn', at: take.turnAt },
  ]
  for (const frame of take.frames) {
    if (frame.t < take.responseStart) continue
    const off = offTarget(frame, target)
    if (off !== null) heard.push({ t: frame.t, cents: off })
    if (entry === null) {
      entry = entryHeardIn(heard, take.round, DEMO_RULES)
      if (entry !== null) marks.push({ type: 'entry', at: frame.t })
    }
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
        return { marks, entry, landed: outcome.landed }
      }
    }
  }
  return { marks, entry, landed: null }
}

const types = (r: Replay): string[] => r.marks.map((m) => m.type)

/** The take's voice, cents off the singer's first note, where it sang. */
function sung(take: FirstNoteDemoTake): number[] {
  const target = entryPitch(take.round.entry)
  return take.frames
    .map((frame) => offTarget(frame, target))
    .filter((cents): cents is number => cents !== null)
}

describe("the First note demo's takes", () => {
  it("leads in on Josephine's first entry, at Singer, its line low on the stage", () => {
    const josephine = FIRST_NOTE_SONGS.find((song) => song.slug === DEMO_SLUG)
    expect(josephine?.entries[0]).toBe(demoEntry())
    expect(DEMO_LEVEL).toBe('singer')
    expect(DEMO_RULES).toBe(FIRST_NOTE_LEVELS.singer)
    // At Singer the line shows once the singer has come in.
    expect(DEMO_RULES.line).toBe('afterEntry')
    const round = demoRound()
    expect(round.index).toBe(0)
    expect(round.song.slug).toBe(DEMO_SLUG)
  })

  it('plays the eight-second clip it ships, the turn opening where the band stops', () => {
    const take = demoTake('off')
    // The clip (demo-band-josephine.mp3) is the entry's `from` to its `at`.
    expect(leadInSeconds()).toBeCloseTo(8, 6)
    expect(take.introAt).toBe(INTRO_AT)
    expect(take.turnAt).toBeCloseTo(INTRO_AT + leadInSeconds(), 9)
    expect(take.responseStart).toBeCloseTo(
      take.turnAt + RESPONSE_GATE_SECONDS,
      9,
    )
    // Nothing is sung over the band.
    const target = entryPitch(take.round.entry)
    const early = take.frames.filter(
      (frame) =>
        frame.t < take.responseStart && offTarget(frame, target) !== null,
    )
    expect(early).toEqual([])
  })

  it('take 1: comes in a step under the note, held and let go: no landing', () => {
    const take = demoTake('off')
    const heard = replay(take)
    // As the room's ears report them, and as the script itself saw them.
    expect(types(heard)).toEqual(['band', 'turn', 'entry', 'miss:0', 'outcome'])
    expect(take.events.map((e) => e.type)).toEqual(types(heard))
    expect(take.landed).toBe(false)
    expect(heard.landed).toBe(false)
    // The entry came in low, off the note: what the tooltip says.
    expect(heard.entry?.onNote).toBe(false)
    expect(heard.entry?.cents).toBeLessThan(-150)
    expect(take.entry).toEqual(heard.entry)
    // A whole step under it, held: most of what was sung sits there.
    const step = sung(take).filter(
      (cents) => Math.abs(cents - STEP_UNDER_CENTS) <= 30,
    )
    expect(step.length).toBeGreaterThan(60)
  })

  it('take 2: comes in on the note and holds it in the band: it lands', () => {
    const take = demoTake('on')
    const heard = replay(take)
    expect(types(heard)).toEqual(['band', 'turn', 'entry', 'land:0', 'outcome'])
    expect(take.events.map((e) => e.type)).toEqual(types(heard))
    expect(take.landed).toBe(true)
    expect(heard.landed).toBe(true)
    expect(heard.entry?.onNote).toBe(true)
    expect(take.answer).toEqual([])
  })

  it("has Merc sing the note after take 1's miss, as a run's answer comes", () => {
    const take = demoTake('off')
    const outcome = take.events.find((e) => e.type === 'outcome')?.at ?? 0
    expect(take.answer).toHaveLength(1)
    expect(take.answer[0].midi).toBe(entryPitch(take.round.entry))
    expect(take.answer[0].at).toBeGreaterThan(outcome)
    expect(take.answer[0].seconds).toBe(MERC_NOTE_SECONDS)
  })

  it('plays the same frames every time', () => {
    expect(demoTake('off').frames).toEqual(demoTake('off').frames)
    expect(demoTake('on').voice).toEqual(demoTake('on').voice)
  })
})

describe("the First note demo's plan", () => {
  it('gives every tooltip its read, in order, before the take moves on', () => {
    const plan = planFirstNoteDemo()
    expect(plan.note).toBe(demoEntry().midi)
    expect(plan.cues.map((c) => c.id)).toEqual([
      'band',
      'turn',
      'low',
      'sings',
      'lands',
    ])
    const offEnd = plan.takeStart.off + plan.takes.off.length
    const onEnd = plan.takeStart.on + plan.takes.on.length
    /** When each tooltip is replaced, or its take moves on. */
    const gone = [
      plan.cues[1].at,
      plan.cues[2].at,
      plan.cues[3].at,
      offEnd + DEMO_BEATS.afterOff,
      onEnd + DEMO_BEATS.afterOn,
    ]
    plan.cues.forEach((cue, i) => {
      expect(gone[i] - cue.at).toBeGreaterThanOrEqual(TIP_READ_SECONDS)
    })
  })

  it('counts in while the band plays: "the song plays" before the turn', () => {
    const plan = planFirstNoteDemo()
    const band = plan.cues.find((c) => c.id === 'band')
    expect(band?.at).toBeLessThan(plan.takeStart.off + plan.takes.off.turnAt)
  })

  it('says "a step under" while take 1 still sings it', () => {
    const plan = planFirstNoteDemo()
    const take = plan.takes.off
    const low = plan.cues.find((c) => c.id === 'low')
    const lastSung = take.voice.filter((point) => point.level > 0).at(-1)
    expect(low?.at).toBeLessThan(plan.takeStart.off + (lastSung?.t ?? 0))
  })

  it("lets Merc's note finish before the room empties", () => {
    const plan = planFirstNoteDemo()
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
