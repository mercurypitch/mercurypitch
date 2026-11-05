// ============================================================
// Phrase reading tests — the notes a sung phrase ran over, on synthetic frames
// ============================================================
//
// Lesson 14's checkpoint reads a phrase for its range and nothing else (its
// WEB-SPEC, Toys 4 and Tests 8). The frames are what the F0 stream hands
// over, one every 16 ms (the detector's hop), silent until the voice
// starts, as `readTake`'s tests build them. Every case is the WEB-SPEC's,
// then the octave line's edges, the spoken form, and the claims check over
// every line the reader can give.

import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { F0Frame } from '@/lib/mirror/metrics'
import { DEFAULT_HOP_SEC } from '@/lib/mirror/metrics'
import { NOT_HEARD_PHRASE_LINE, PHRASE_VOICE_SEC, rangeLine, readRange, } from './take'

const HOP = DEFAULT_HOP_SEC
const D3 = 50
const A3 = 57
const B3 = 59

/** A stretch of a take: a note at MIDI `midi`, `level` of the voice's confidence, or silence. */
type Part =
  | { readonly midi: number; readonly sec: number; readonly conf?: number }
  | { readonly rest: number }

const hzOf = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

/** The frames of a take: half a second of silence, then each part in turn. */
function takeOf(parts: readonly Part[], lead = 0.5): F0Frame[] {
  const frames: F0Frame[] = []
  let t = 0
  const push = (sec: number, f0: number, conf: number): void => {
    for (const end = t + sec; t < end - 1e-9; t += HOP)
      frames.push({ t, f0, conf })
  }
  push(lead, 0, 0)
  for (const p of parts) {
    if ('rest' in p) push(p.rest, 0, 0)
    else push(p.sec, hzOf(p.midi), p.conf ?? 0.95)
  }
  return frames
}

/** Phrase 1 from do: do do so so la la so, crotchets of 0.75 s and a minim, a whole step `shift` away. */
function phrase(doMidi: number, breath: 'none' | 'after' = 'none'): Part[] {
  const notes = [0, 0, 7, 7, 9, 9]
  const parts: Part[] = notes.map((s) => ({ midi: doMidi + s, sec: 0.75 }))
  parts.push({ midi: doMidi + 7, sec: breath === 'after' ? 1.2 : 1.5 })
  if (breath === 'after') parts.push({ rest: 0.3 })
  return parts
}

describe('readRange', () => {
  it('reads phrase 1 sung on pitch from D3 as running from D3 to B3, with no octave line', () => {
    // Act
    const r = readRange(takeOf(phrase(D3)), 1, D3, B3)

    // Assert
    expect(r).toMatchObject({ heard: true, low: D3, high: B3 })
    expect(r.line).toBe(
      "Take 1, drawn over Merc's bands: your line ran from about D3 to B3.",
    )
    expect(r.heard && r.octaveLine).toBeNull()
  })

  it('reads the phrase an octave lower as D2 to B2, and adds the octave line in the plural', () => {
    // Act
    const r = readRange(takeOf(phrase(D3 - 12)), 2, D3, B3)

    // Assert
    expect(r.line).toBe(
      "Take 2, drawn over Merc's bands: your line ran from about D2 to B2.",
    )
    expect(r.heard && r.octaveLine).toBe(
      'You sang it an octave lower: same notes.',
    )
  })

  it('reads the phrase two octaves higher with "two octaves higher"', () => {
    // Act
    const r = readRange(takeOf(phrase(D3 + 24)), 1, D3, B3)

    // Assert
    expect(r.heard && r.octaveLine).toBe(
      'You sang it two octaves higher: same notes.',
    )
  })

  it('reads a steady A3 held for 6 s as staying at about A3', () => {
    // Act
    const r = readRange(takeOf([{ midi: A3, sec: 6 }]), 1, D3, B3)

    // Assert
    expect(r.line).toBe(
      "Take 1, drawn over Merc's bands: your line stayed at about A3.",
    )
    expect(r.heard && r.octaveLine).toBeNull()
  })

  it('reads D2 to A2 as its range, with no octave line: la is not A', () => {
    // Arrange: an octave under do, but stopping on so's octave, not la's
    const parts: Part[] = [0, 0, 2, 4, 5, 7, 7].map((s) => ({
      midi: 38 + s,
      sec: 0.9,
    }))

    // Act
    const r = readRange(takeOf(parts), 1, D3, B3)

    // Assert
    expect(r.line).toBe(
      "Take 1, drawn over Merc's bands: your line ran from about D2 to A2.",
    )
    expect(r.heard && r.octaveLine).toBeNull()
  })

  it("gives no reading for 1.4 s of voice: we didn't hear the phrase", () => {
    // Act
    const r = readRange(takeOf([{ midi: A3, sec: 1.4 }]), 1, D3, B3)

    // Assert
    expect(r).toEqual({ heard: false, line: NOT_HEARD_PHRASE_LINE })
    expect(NOT_HEARD_PHRASE_LINE).toBe("We didn't hear the phrase that time.")
    expect(PHRASE_VOICE_SEC).toBe(1.5)
  })

  it('reads a take with no voice at all, or only frames under the confidence floor, as not heard', () => {
    // Act
    const silent = readRange(takeOf([{ rest: 6 }]), 1, D3, B3)
    const faint = readRange(
      takeOf([{ midi: A3, sec: 6, conf: 0.1 }]),
      1,
      D3,
      B3,
    )

    // Assert
    expect(silent.heard).toBe(false)
    expect(faint.heard).toBe(false)
  })

  it('reads a take with its 0.3 s breath after "star" as one without it: it reads no breath', () => {
    // Act
    const without = readRange(takeOf(phrase(D3)), 2, D3, B3)
    const breathed = readRange(takeOf(phrase(D3, 'after')), 2, D3, B3)

    // Assert
    expect(breathed.line).toBe(without.line)
  })

  it('reads a phrase sung late the same as one sung at once: no timing is judged', () => {
    // Act
    const prompt = readRange(takeOf(phrase(D3)), 1, D3, B3)
    const late = readRange(takeOf(phrase(D3), 4), 1, D3, B3)

    // Assert
    expect(late.line).toBe(prompt.line)
  })

  it('keeps a short octave jump of the detector from deciding the range', () => {
    // Arrange: two frames an octave up in the middle of the phrase
    const parts: Part[] = [
      ...phrase(D3).slice(0, 3),
      { midi: D3 + 19, sec: 2 * HOP },
      ...phrase(D3).slice(3),
    ]

    // Act
    const r = readRange(takeOf(parts), 1, D3, B3)

    // Assert
    expect(r).toMatchObject({ low: D3, high: B3 })
  })

  it('names the notes in the spoken form with words for every sign', () => {
    // Act: a phrase from E3 runs to C sharp 4
    const r = readRange(takeOf(phrase(52)), 1, D3, B3)

    // Assert
    expect(r.line).toBe(
      "Take 1, drawn over Merc's bands: your line ran from about E3 to C♯4.",
    )
    expect(r.heard && r.spoken).toBe(
      "Take 1, drawn over Merc's bands: your line ran from about E3 to C sharp 4.",
    )
  })

  it('changes no line when only the loudness changes', () => {
    // Arrange: the same phrase, every frame's confidence lower but still voiced
    const quiet = takeOf(phrase(D3)).map((f) => ({
      ...f,
      conf: f.conf > 0 ? 0.7 : 0,
    }))

    // Act
    const loud = readRange(takeOf(phrase(D3)), 1, D3, B3)
    const soft = readRange(quiet, 1, D3, B3)

    // Assert
    expect(soft.line).toBe(loud.line)
  })
})

describe('the phrase lines', () => {
  it('pass the claims check as findings, and hold no count, score, "Try again" or "Listen again"', () => {
    // Arrange: every shape of line, both takes, both octaves either way
    const lines = new Set<string>([NOT_HEARD_PHRASE_LINE])
    for (const take of [1, 2])
      for (let low = 38; low <= 74; low += 1) {
        lines.add(rangeLine(take, low, low))
        lines.add(rangeLine(take, low, low + 9))
      }
    for (const shift of [-24, -12, 12, 24]) {
      const r = readRange(takeOf(phrase(D3 + shift)), 1, D3, B3)
      if (r.heard && r.octaveLine !== null) lines.add(r.octaveLine)
    }

    for (const text of lines) {
      // Act
      const result = validateGuidedDynamicClaim({ surface: 'finding', text })

      // Assert
      expect(result.violations, text).toEqual([])
      expect(text).not.toMatch(/try again|listen again|\d+ of|score|%/i)
    }
  })
})
