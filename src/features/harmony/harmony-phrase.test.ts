import { describe, expect, it } from 'vitest'
import { midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { createSequenceState, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { HarmonyLine } from './harmony-line'
import { harmonyPhrase, lineOutcome, mercCall, mercLine, sungSeconds, } from './harmony-phrase'
import { HARMONY_LEVELS, LINE_BREATH_SECONDS, MERC_GAP_SECONDS, togetherRules, } from './harmony-rules'

const LINE: HarmonyLine = {
  index: 0,
  tonic: 48,
  merc: [55, 57, 59],
  harmony: [59, 60, 62],
  below: false,
}
const BELOW: HarmonyLine = { ...LINE, harmony: [52, 53, 55], below: true }

/** A voice on `midi` (or silence) for `seconds`, a frame every 1/60 s from `t0`. */
function voice(
  plan: readonly { midi: number | null; seconds: number }[],
  t0 = 0,
): PitchFrame[] {
  const frames: PitchFrame[] = []
  let t = t0
  for (const part of plan) {
    const end = t + part.seconds
    for (; t < end; t += 1 / 60) {
      frames.push(
        part.midi === null
          ? { t, f0: 0, conf: 0, rms: 0.001 }
          : { t, f0: midiToF0(part.midi), conf: 0.9, rms: 0.4 },
      )
    }
  }
  return frames
}

function hear(
  line: HarmonyLine,
  frames: readonly PitchFrame[],
  rules = HARMONY_LEVELS.learning,
) {
  let engine = createSequenceState(0)
  for (const frame of frames) {
    engine = tickSequence(engine, frame, harmonyPhrase(line, rules), rules)
  }
  return lineOutcome(engine, line, { voiced: false, heardAgain: false })
}

describe("Harmony's phrase", () => {
  it("sings Merc's line back to back at the level's pace", () => {
    const rules = HARMONY_LEVELS.singer
    const notes = mercLine({ ...LINE, merc: [55, 57, 59, 57] }, rules)
    expect(notes.map((n) => n.at)).toEqual(
      [0, 1, 2, 3].map((i) => i * (rules.noteSeconds + MERC_GAP_SECONDS)),
    )
    expect(sungSeconds(4, rules)).toBeCloseTo(
      4 * rules.noteSeconds + 3 * MERC_GAP_SECONDS,
    )
  })

  it('calls his line alone, and at Learning the harmony after a breath', () => {
    const singer = mercCall(LINE, HARMONY_LEVELS.singer)
    expect(singer.his).toBe(3)
    expect(singer.notes.map((n) => n.midi)).toEqual(LINE.merc)
    const learning = mercCall(LINE, HARMONY_LEVELS.learning)
    expect(learning.notes.map((n) => n.midi)).toEqual([
      ...LINE.merc,
      ...LINE.harmony,
    ])
    expect(learning.notes[3].at).toBeCloseTo(
      sungSeconds(3, HARMONY_LEVELS.learning) + LINE_BREATH_SECONDS,
    )
  })

  it('hears a harmony sung in free time as a line in harmony', () => {
    const outcome = hear(
      LINE,
      voice([
        { midi: 59, seconds: 0.6 },
        { midi: 60, seconds: 0.6 },
        { midi: 62, seconds: 0.6 },
        { midi: null, seconds: 2 },
      ]),
    )
    expect(outcome).toMatchObject({
      inHarmony: true,
      firstMiss: null,
      notes: [true, true, true],
      voiced: true,
    })
  })

  it('names a flat third under a harmony above as short of it', () => {
    // The last note 70 cents flat: well off the note before it, so it is a
    // try at the last one, toward Merc's line under it.
    const outcome = hear(
      LINE,
      voice([
        { midi: 59, seconds: 0.6 },
        { midi: 60, seconds: 0.6 },
        { midi: 61.3, seconds: 0.8 },
        { midi: null, seconds: 3 },
      ]),
    )
    expect(outcome).toMatchObject({ inHarmony: false, firstMiss: 2 })
    expect(outcome?.short).toBe(true)
  })

  it('names a sharp third over a harmony below as short of it', () => {
    const outcome = hear(
      BELOW,
      voice([
        { midi: 52, seconds: 0.6 },
        { midi: 53.7, seconds: 0.8 },
        { midi: null, seconds: 3 },
      ]),
    )
    expect(outcome).toMatchObject({ inHarmony: false, firstMiss: 1 })
    expect(outcome?.short).toBe(true)
  })

  it("hears a harmony sung together in each note's window on Merc's clock", () => {
    const rules = togetherRules(HARMONY_LEVELS.learning)
    expect(rules.timing.mode).toBe('timed')
    const step = rules.noteSeconds + MERC_GAP_SECONDS
    // In time with him, a little late, as headphones are.
    const late = 0.15
    const outcome = hear(
      LINE,
      voice(
        [
          { midi: 59, seconds: step },
          { midi: 60, seconds: step },
          { midi: 62, seconds: rules.noteSeconds },
          { midi: null, seconds: 1 },
        ],
        late,
      ),
      rules,
    )
    expect(outcome?.inHarmony).toBe(true)
  })

  it('misses a note sung together after its window has closed', () => {
    const rules = togetherRules(HARMONY_LEVELS.singer)
    const step = rules.noteSeconds + MERC_GAP_SECONDS
    const outcome = hear(
      LINE,
      voice([
        { midi: 59, seconds: step },
        { midi: null, seconds: step + 0.5 },
        { midi: 62, seconds: rules.noteSeconds },
        { midi: null, seconds: 1 },
      ]),
      rules,
    )
    expect(outcome).toMatchObject({
      notes: [true, false, true],
      firstMiss: 1,
    })
  })
})
