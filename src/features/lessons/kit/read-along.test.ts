// ============================================================
// Read-along tests — each note passes on its hold, or moves on at 8 s
// ============================================================
//
// Lesson 16's WEB-SPEC, Tests 7 (FACTS 45, 47): a note passes at 0.45 s of
// frames within 60 cents and not at 0.44; a frame outside takes back half
// its time, never below zero; a frame an octave away counts; at 8 s the
// next note lights; a take with no voice reads as none; the lines name the
// written note, give Lesson 3's octave line within 50 cents and the
// not-steady line, and carry no count or advice.

import { describe, expect, it } from 'vitest'
import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { readAlong, readingLines, readNotes } from './read-along'

/** The voiced frames' hop, s: a frame stands for 10 ms. */
const HOP = 0.01

/** G4, A4, B4, A4, G4: the first phrase in the treble. */
const PHRASE = [67, 69, 71, 69, 67]

/** Voiced frames from `from` for `sec` seconds at `cents` (MIDI cents). */
function sung(from: number, sec: number, cents: number): VoicedFrame[] {
  const out: VoicedFrame[] = []
  for (let i = 0; i * HOP < sec - 1e-9; i++)
    out.push({ t: from + i * HOP, cents })
  return out
}

/** Raw frames for `readTake`, at `hz`, from `from` for `sec` seconds. */
function raw(from: number, sec: number, hz: number): F0Frame[] {
  const out: F0Frame[] = []
  for (let i = 0; i * HOP < sec - 1e-9; i++)
    out.push({ t: from + i * HOP, f0: hz, conf: 0.95 })
  return out
}

/** Feeds frames one at a time, as a take's animation frames would. */
function feedAll(
  along: ReturnType<typeof readAlong>,
  frames: readonly VoicedFrame[],
): void {
  for (let i = 0; i < frames.length; i++)
    along.feed(frames.slice(0, i + 1), frames[i].t)
}

describe('readAlong', () => {
  it('lights the first note at the first voiced frame, and none before', () => {
    // Arrange
    const along = readAlong(PHRASE)

    // Act
    const before = along.feed([], 1)
    along.feed(sung(1.2, 0.02, 6700), 1.22)

    // Assert
    expect(before).toBe(-1)
    expect(along.current).toBe(0)
    expect(along.runs[0].start).toBe(1.2)
  })

  it('passes a note at 0.45 s of frames within 60 cents, and not at 0.44', () => {
    // Arrange: 59 cents sharp of G4
    const short = readAlong(PHRASE)
    const long = readAlong(PHRASE)

    // Act: a frame's time counts from the one before it, so 46 frames hold 0.45 s
    feedAll(short, sung(0, 0.45, 6759))
    feedAll(long, sung(0, 0.46, 6759))

    // Assert
    expect(short.current).toBe(0)
    expect(long.current).toBe(1)
    expect(long.runs[0].how).toBe('hold')
  })

  it('takes back half the time of a frame outside the window, never below zero', () => {
    // Arrange: 0.3 s in, then 0.2 s 61 cents out, which takes 0.1 s back
    const along = readAlong(PHRASE)
    const frames = [
      ...sung(0, 0.31, 6700),
      ...sung(0.31, 0.2, 6761),
      ...sung(0.51, 0.25, 6700),
    ]

    // Act: from 0.2 s of hold, 0.24 s more passes it and 0.23 s does not
    feedAll(along, frames.slice(0, 31 + 20 + 23))
    const under = along.current
    feedAll(along, frames.slice(0, 31 + 20 + 25))

    // Assert
    expect(under).toBe(0)
    expect(along.current).toBe(1)

    // and a note held for none of its time stays at zero, not below
    const out = readAlong(PHRASE)
    feedAll(out, [...sung(0, 1, 6800), ...sung(1, 0.46, 6700)])
    expect(out.current).toBe(1)
  })

  it('counts a frame an octave away as in: any octave is the note', () => {
    // Arrange: G3 against the written G4
    const along = readAlong(PHRASE)

    // Act
    feedAll(along, sung(0, 0.46, 5500))

    // Assert
    expect(along.current).toBe(1)
  })

  it('lights the next note 8 s after a note began, voice or none, and is done after the last', () => {
    // Arrange: a voice that never lands
    const along = readAlong([67, 69])

    // Act: the first frame, then silence to 8.2 s; then off-pitch to 16.2 s
    along.feed(sung(0, 0.01, 6000), 0)
    along.feed(sung(0, 0.01, 6000), 8.2)
    const second = along.current
    along.feed(sung(0, 0.01, 6000), 16.2)

    // Assert
    expect(second).toBe(1)
    expect(along.runs[0]).toMatchObject({ start: 0, end: 8, how: 'time' })
    expect(along.done).toBe(true)
    expect(along.runs[1]).toMatchObject({ start: 8, end: 16, how: 'time' })
  })

  it('takes back half of a stretch with no voice', () => {
    // Arrange: 0.4 s held, then 0.3 s of nothing, then 0.1 s in
    const along = readAlong(PHRASE)
    feedAll(along, sung(0, 0.41, 6700))

    // Act: the silence takes 0.15 s back, so 0.1 s more leaves it short
    along.feed(sung(0, 0.41, 6700), 0.81)
    const frames = [...sung(0, 0.41, 6700), ...sung(0.81, 0.1, 6700)]
    feedAll(along, frames)

    // Assert
    expect(along.current).toBe(0)
  })
})

describe('readNotes and readingLines', () => {
  const LABELS = ['Do', 'Re', 'Mi', 'Re', 'Do']

  it('reads a held note from the frames that counted, naming the written note, with no advice', () => {
    // Arrange: G4 20 cents flat, then A4 right on, then nothing more
    const along = readAlong(PHRASE)
    feedAll(along, [...sung(0, 0.5, 6680), ...sung(0.5, 0.5, 6900)])

    // Act
    const lines = readingLines(LABELS, readNotes(along, PHRASE, []))

    // Assert: the take ended before mi, so the rest heard no steady note
    expect(lines).toEqual([
      'Do · In the band: 20 cents below the written note.',
      'Re · Right in the middle: on the written note.',
      "Mi · We didn't hear a steady note there.",
      "Re · We didn't hear a steady note there.",
      "Do · We didn't hear a steady note there.",
    ])
    for (const line of lines) expect(line).not.toMatch(/again|try|\d+ of \d+/i)
  })

  it("gives Lesson 3's octave line within 50 cents of the note an octave away", () => {
    // Arrange: G3 for the written G4, 10 cents flat
    const along = readAlong([67])
    feedAll(along, sung(0, 0.5, 5490))

    // Act
    const [line] = readingLines(['Do'], readNotes(along, [67], []))

    // Assert
    expect(line).toBe(
      'Do · Right in the middle: 10 cents below the written note. You sang it an octave lower: same note.',
    )
  })

  it('reads a note the 8 s moved past by its stretch of the raw frames, or as not steady with too little voice', () => {
    // Arrange: a steady A4 for the first written G4, two semitones off, never passing
    const along = readAlong([67, 69])
    const voiced = sung(0, 8.2, 6900)
    feedAll(
      along,
      voiced.filter((_, i) => i % 20 === 0 || i === voiced.length - 1),
    )

    // Act
    const lines = readingLines(
      ['Do', 'Re'],
      readNotes(along, [67, 69], raw(0, 8.2, 440)),
    )

    // Assert: the moved-past note is read over its 8 s; the next had too little voice
    expect(lines[0]).toBe(
      'Do · About two semitones above, nearer a different note.',
    )
    expect(lines[1]).toBe("Re · We didn't hear a steady note there.")
  })

  it('reads a take with no voice as none heard', () => {
    // Act
    const lines = readingLines(LABELS, readNotes(readAlong(PHRASE), PHRASE, []))

    // Assert
    expect(new Set(lines.map((l) => l.split(' · ')[1]))).toEqual(
      new Set(["We didn't hear a steady note there."]),
    )
  })
})
