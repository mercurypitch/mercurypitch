// ============================================================
// Quiet check tests — two seconds of the drone, and no note heard
// ============================================================
//
// The check reads synthetic frames 16 ms apart, as the hold reader's tests
// do, through Voice Mirror's own preprocessing: silence passes; a steady
// tone on the drone's pitch, or an octave from it, for 0.3 s or more fails,
// since a speaker's drone is what it guards against; a voiced run of 0.3 s
// at an unrelated pitch, a tritone from do, fails too, since it cannot tell
// a voice from the drone; a run of 0.2 s at any pitch passes (Lesson 24
// WEB-SPEC, Tests 8; What the kit and the app still need, item 6).

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/mirror/metrics'
import { HEARD_LINE, HEARD_RUN_SEC, heardNothing, longestRun, QUIET_LINE, QUIET_SEC, } from './quiet-check'

const HOP = 0.016
/** The lower voice's drone and do, D3. */
const D3 = 146.83

/** Two seconds of frames, voiced at `hz` from `from` for `run` seconds, silent elsewhere. */
function frames(hz: number, from: number, run: number): F0Frame[] {
  const out: F0Frame[] = []
  for (let i = 0; i * HOP < QUIET_SEC; i++) {
    const t = i * HOP
    const sung = t >= from && t < from + run
    out.push({ t, f0: sung ? hz : 0, conf: sung ? 0.95 : 0.1 })
  }
  return out
}

describe('the quiet check', () => {
  it('passes two seconds of silence', () => {
    // Arrange
    const quiet = frames(D3, 0, 0)

    // Assert
    expect(longestRun(quiet).seconds).toBe(0)
    expect(heardNothing(quiet)).toBe(true)
  })

  it("fails a steady tone on the drone's pitch, or an octave from it, of 0.3 s or more", () => {
    // Arrange: the drone through a speaker, heard now and then or throughout
    const heard = [
      frames(D3, 0.5, 0.3),
      frames(D3, 0, 2),
      frames(D3 * 2, 0.8, 0.4),
      frames(D3 / 2, 1.2, 0.3),
    ]

    // Assert
    for (const f of heard) {
      // a hop's sampling can show a 0.3 s run one frame short
      expect(longestRun(f).seconds).toBeGreaterThan(HEARD_RUN_SEC - HOP)
      expect(heardNothing(f)).toBe(false)
    }
  })

  it('fails a voiced run of 0.3 s at an unrelated pitch, a tritone from do, as it would the drone', () => {
    // Arrange: a hum or an early answer on G sharp 3, a tritone above D3
    const hum = frames(D3 * 2 ** (6 / 12), 1, 0.3)

    // Assert
    expect(heardNothing(hum)).toBe(false)
  })

  it('fails a 0.3 s run however its frames fall against the hop', () => {
    // Arrange: the same 0.3 s run, starting at each of a hop's phases
    const phases = [0, 0.004, 0.008, 0.012].map((p) => frames(D3, 0.5 + p, 0.3))

    // Assert
    for (const f of phases) expect(heardNothing(f)).toBe(false)
  })

  it('passes a run of 0.2 s at any pitch', () => {
    // Arrange
    const short = [
      frames(D3, 0.4, 0.2),
      frames(D3 * 2 ** (6 / 12), 1, 0.2),
      frames(D3 * 2, 1.6, 0.2),
    ]

    // Assert
    for (const f of short) {
      expect(longestRun(f).seconds).toBeLessThan(HEARD_RUN_SEC - HOP)
      expect(heardNothing(f)).toBe(true)
    }
  })

  it('counts two short runs split by a gap as two, not one: each under 0.3 s passes', () => {
    // Arrange: 0.2 s, then 0.2 s of quiet, then 0.2 s more
    const twice = frames(D3, 0.3, 0.2).map((f, i, all) =>
      f.t >= 0.7 && f.t < 0.9 ? { ...f, f0: D3, conf: 0.95 } : all[i],
    )

    // Assert
    expect(heardNothing(twice)).toBe(true)
  })

  it("says LESSON.md's two lines", () => {
    // Assert: Lesson 24's LESSON.md, Sing it
    expect(QUIET_LINE).toBe(
      "First, stay quiet for two seconds while the drone plays: the page checks that the microphone can't hear it.",
    )
    expect(HEARD_LINE).toBe(
      'The microphone heard a note during the drone. Check your headphones, then press Start again and stay quiet.',
    )
  })
})
