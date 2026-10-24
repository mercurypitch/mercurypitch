// ============================================================
// Ladder reading tests — a sung ladder, a rung at a time, on synthetic frames
// ============================================================
//
// Lesson 9's checkpoint reads a ladder note by note (its WEB-SPEC, Toys 4
// and Tests 6). The frames are what the F0 stream hands over, one every 16 ms
// (the detector's hop), silent until the voice starts. Every case is the
// WEB-SPEC's, then where the slots start (the take's first voiced frame, or
// the take's own voicedAt when the page passes it), the lines a rung can
// earn, and the claims check over all of them.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import { CONF_MIN, DEFAULT_HOP_SEC } from '@/lib/mirror/metrics'
import type { LadderReading, TakeReading } from './take'
import { countLine, LADDER_SLOT_SEC, NONE_HEARD_LINE, NOT_STEADY_RUNG_LINE, readLadder, readTake, rungLine, TRICKY_LINE, trickyAfter, } from './take'

const HOP = DEFAULT_HOP_SEC

const D3 = 50
const FS3 = 54
const A3 = 57
const D4 = 62

/** The two ladders from do D3, as sung, with their labels (WEB-SPEC, Toys 4). */
const FULL = [D3, FS3, A3, D4]
const FULL_LABELS = ['Do', 'Mi', 'So', 'Top do']
const SMALLER = [D3, FS3, A3, FS3, D3]
const SMALLER_LABELS = ['Do', 'Mi', 'So', 'Mi again', 'Do again']

/** A stretch of a take: a note `cents` off MIDI `midi`, a sound under the confidence floor, or silence. */
type Part =
  | { readonly midi: number; readonly sec: number; readonly cents?: number }
  | { readonly noise: number }
  | { readonly rest: number }

const hzOf = (midi: number, cents = 0): number =>
  440 * 2 ** ((midi * 100 + cents - 6900) / 1200)

const lengthOf = (p: Part): number =>
  'sec' in p ? p.sec : 'noise' in p ? p.noise : p.rest

function frameOf(p: Part | undefined, t: number): F0Frame {
  if (p === undefined || 'rest' in p) return { t, f0: 0, conf: 0 }
  if ('noise' in p) return { t, f0: hzOf(64), conf: CONF_MIN / 2 }
  return { t, f0: hzOf(p.midi, p.cents), conf: 0.95 }
}

/** The raw frames of a take: `wait` seconds of silence, then the parts, a frame every hop. */
function take(parts: readonly Part[], wait = 0.8): F0Frame[] {
  const spans: { from: number; to: number; part: Part }[] = []
  let end = wait
  for (const part of parts) {
    spans.push({ from: end, to: end + lengthOf(part), part })
    end += lengthOf(part)
  }
  const frames: F0Frame[] = []
  for (let i = 0; i * HOP < end; i++) {
    const t = i * HOP
    frames.push(frameOf(spans.find((s) => t >= s.from && t < s.to)?.part, t))
  }
  return frames
}

/** Each note for `sec` seconds, `cents` off. */
const notes = (midis: readonly number[], sec = 1.5, cents = 0): Part[] =>
  midis.map((midi) => ({ midi, sec, cents }))

/** A heard ladder's lines, one a rung under its label; none when nothing was heard. */
const linesOf = (r: LadderReading, labels: readonly string[]): string[] =>
  r.heard ? r.slots.map((s, i) => rungLine(labels[i], s)) : []

/** The count's line as the page says it; null when nothing was heard. */
const countOf = (r: LadderReading): string | null =>
  r.heard ? (countLine(r.count) ?? NONE_HEARD_LINE) : null

const allInTheMiddle = (labels: readonly string[]): string[] =>
  labels.map((label) => `${label} · Right in the middle: on Merc's note.`)

/**
 * A click at 0.25 s that clears the confidence floor, then the full ladder
 * from 1.5 s: over 0.9 s apart, so slots started at the click would read
 * each rung against the note before it.
 */
const withClick = (): F0Frame[] =>
  take([{ midi: 70, sec: 0.0625 }, { rest: 1.1875 }, ...notes(FULL)], 0.25)

describe('readLadder', () => {
  it('reads D3, F♯3, A3 and D4 for 1.5 s each as four notes right in the middle, 4 of 4', () => {
    // Act
    const r = readLadder(take(notes(FULL)), FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(allInTheMiddle(FULL_LABELS))
    expect(countOf(r)).toBe('This time, 4 of your 4 notes landed in the band.')
  })

  it('reads each note sung 30 cents flat as in the band, 30 cents below', () => {
    // Act
    const r = readLadder(take(notes(FULL, 1.5, -30)), FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(
      FULL_LABELS.map((l) => `${l} · In the band: 30 cents below Merc's note.`),
    )
    expect(countOf(r)).toBe('This time, 4 of your 4 notes landed in the band.')
  })

  it('reads one A3 held for 6.0 s as so in the middle and the other rungs nearer different notes, 1 of 4', () => {
    // Act
    const r = readLadder(take([{ midi: A3, sec: 6 }]), FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual([
      'Do · About five semitones below, nearer a different note.',
      'Mi · About three semitones above, nearer a different note.',
      "So · Right in the middle: on Merc's note.",
      'Top do · About five semitones below, nearer a different note.',
    ])
    expect(countOf(r)).toBe('This time, 1 of your 4 notes landed in the band.')
    expect(r.heard && trickyAfter(r.count)).toBe(true)
  })

  it('reads the top do sung an octave low as the same note, and counts it landed', () => {
    // Act
    const r = readLadder(take(notes([D3, FS3, A3, D3])), FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)[3]).toBe(
      "Top do · Right in the middle: on Merc's note. You sang it an octave lower: same note.",
    )
    expect(countOf(r)).toBe('This time, 4 of your 4 notes landed in the band.')
  })

  it('reads a slot with only 0.4 s of voice as no steady note, and leaves it out of the count', () => {
    // Arrange: mi stops after 0.4 s, and so starts on time
    const frames = take([
      { midi: D3, sec: 1.5 },
      { midi: FS3, sec: 0.4 },
      { rest: 1.1 },
      ...notes([A3, D4]),
    ])

    // Act
    const r = readLadder(frames, FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)[1]).toBe(
      "Mi · We didn't hear a steady note there.",
    )
    expect(countOf(r)).toBe(
      'This time, 3 of the 3 notes we heard landed in the band.',
    )
  })

  it('hears nothing in a take with no voice at all', () => {
    // Act
    const r = readLadder(take([], 6), FULL)

    // Assert
    expect(r).toEqual({ heard: false })
  })

  it('hears a take with voice in every slot but no steady note: four rungs not steady, none counted', () => {
    // Arrange: each rung sung for 0.4 s, under the 0.9 s a slot needs, then silence to its slot's end
    const frames = take(
      FULL.flatMap((midi): Part[] => [{ midi, sec: 0.4 }, { rest: 1.1 }]),
    )

    // Act
    const r = readLadder(frames, FULL)

    // Assert: heard, so the page asks how it felt and counts the take (Lesson 9 FACTS 78)
    expect(r.heard).toBe(true)
    expect(linesOf(r, FULL_LABELS)).toEqual(
      FULL_LABELS.map((l) => `${l} · We didn't hear a steady note there.`),
    )
    expect(r.heard && r.count).toEqual({ heard: 0, landed: 0, of: 4 })
    expect(countOf(r)).toBe(NONE_HEARD_LINE)
  })

  it('reads every rung of a ladder sung 0.3 s late in every note: the attack trim takes each move', () => {
    // Arrange: each move comes 0.3 s after its slot begins, and the top do has what is left
    const frames = take([
      { midi: D3, sec: 1.8 },
      { midi: FS3, sec: 1.5 },
      { midi: A3, sec: 1.5 },
      { midi: D4, sec: 1.2 },
    ])

    // Act
    const r = readLadder(frames, FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(allInTheMiddle(FULL_LABELS))
    expect(countOf(r)).toBe('This time, 4 of your 4 notes landed in the band.')
  })

  it('reads the smaller ladder in five slots, with "Mi again" and "Do again"', () => {
    // Act
    const r = readLadder(take(notes(SMALLER)), SMALLER)

    // Assert
    expect(linesOf(r, SMALLER_LABELS)).toEqual(allInTheMiddle(SMALLER_LABELS))
    expect(countOf(r)).toBe('This time, 5 of your 5 notes landed in the band.')
  })

  it('reads slots of the length it is given: a ladder at 2 s a note', () => {
    // Act
    const r = readLadder(take(notes(FULL, 2)), FULL, { slotSec: 2 })

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(allInTheMiddle(FULL_LABELS))
  })

  it('gives each rung a slot of 1.5 s by default, as long as Merc sings each note (Lesson 9 FACTS 76)', () => {
    // Assert
    expect(LADDER_SLOT_SEC).toBe(1.5)
  })
})

describe('where the slots start', () => {
  it('starts at the first voiced frame preprocess keeps, after silence and a sound under the confidence floor', () => {
    // Arrange: 0.5 s of silence, then 1 s the detector is unsure of, then the ladder
    const frames = take([{ noise: 1 }, ...notes(FULL)], 0.5)

    // Act
    const r = readLadder(frames, FULL)

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(allInTheMiddle(FULL_LABELS))
  })

  it("starts where the take's own voicedAt does, a click before the ladder included", () => {
    // Arrange: a click at 0.25 s clears the confidence floor, so the take's voicedAt is its first frame
    const frames = withClick()
    const fromVoicedAt = readLadder(frames, FULL, { start: 16 * HOP })

    // Act
    const r = readLadder(frames, FULL)

    // Assert
    expect(r).toEqual(fromVoicedAt)
  })

  it('starts slot 0 at the start it is given, not at an earlier voiced frame', () => {
    // Arrange: the click, then the ladder from 1.5 s
    const frames = withClick()

    // Act
    const r = readLadder(frames, FULL, { start: 1.5 })

    // Assert
    expect(linesOf(r, FULL_LABELS)).toEqual(allInTheMiddle(FULL_LABELS))
    expect(countOf(r)).toBe('This time, 4 of your 4 notes landed in the band.')
  })

  it('reads the same ladder from a start three frames either side of the voice', () => {
    // Arrange: the voice starts at 0.8 s
    const frames = take(notes(FULL))

    for (const shift of [-3, 3]) {
      // Act
      const r = readLadder(frames, FULL, { start: 0.8 + shift * HOP })

      // Assert
      expect(linesOf(r, FULL_LABELS), `${shift} frames`).toEqual(
        allInTheMiddle(FULL_LABELS),
      )
    }
  })
})

describe('rungLine', () => {
  const sung = (target: number, cents: number, sec = 1.5): TakeReading =>
    readTake(take([{ midi: target, sec, cents }]), target)

  it("gives LESSON.md's three example lines", () => {
    // Act
    const lines = [
      rungLine('So', sung(A3, -20)),
      rungLine('Top do', sung(D4, -100)),
      rungLine('Mi', sung(FS3, 0, 0.4)),
    ]

    // Assert
    expect(lines).toEqual([
      "So · In the band: 20 cents below Merc's note.",
      'Top do · About a semitone below, nearer a different note.',
      "Mi · We didn't hear a steady note there.",
    ])
  })

  it('leaves the advice to listen again off a close note', () => {
    // Act
    const line = rungLine('Mi', sung(FS3, -45))

    // Assert
    expect(line).toBe("Mi · Close: 45 cents below Merc's note.")
  })
})

/** Every line a ladder's reading can show: each label with every band both ways, every octave line and no steady note, and every count of four or five notes. */
function everyLadderLine(): Set<string> {
  const readings = [readTake(take([{ midi: A3, sec: 0.4 }]), A3)]
  for (let d = -600; d <= 600; d += 5)
    readings.push(readTake(take([{ midi: A3, sec: 1.5, cents: d }]), A3))
  for (const octaves of [-2, -1, 1, 2])
    for (let d = -50; d <= 50; d += 5)
      readings.push(
        readTake(take([{ midi: A3 + 12 * octaves, sec: 1.5, cents: d }]), A3),
      )
  const lines = new Set([NOT_STEADY_RUNG_LINE, NONE_HEARD_LINE, TRICKY_LINE])
  for (const label of new Set([...FULL_LABELS, ...SMALLER_LABELS]))
    for (const r of readings) lines.add(rungLine(label, r))
  for (const of of [4, 5])
    for (let heard = 1; heard <= of; heard++)
      for (let landed = 0; landed <= heard; landed++)
        lines.add(countLine({ heard, landed, of }) ?? '')
  return lines
}

describe('the claims check (src/lib/guided-voice/claims.ts)', () => {
  it('passes every line a ladder can show as a finding', () => {
    // Arrange
    const lines = everyLadderLine()

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
    }
  })

  it('never says to listen again or to try again, on any line', () => {
    // Act
    const lines = [...everyLadderLine()]

    // Assert: the lines a single note's page would advise on are there, without the advice
    expect(lines).toEqual(
      expect.arrayContaining([
        "Mi · Close: 45 cents below Merc's note.",
        'Do · About six semitones below, nearer a different note.',
        "Top do · We didn't hear a steady note there.",
      ]),
    )
    expect(lines.filter((l) => /listen again|try again/i.test(l))).toEqual([])
  })
})
