import { describe, expect, it } from 'vitest'
import { sequence, silence, tone } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { SETTLE_ONSET_TRIM_SEC, SETTLE_SECONDS, settleLiveNote, } from './settle-note'

const ENOUGH = SETTLE_ONSET_TRIM_SEC + SETTLE_SECONDS + 0.05

/** A voice that never sits still: a third up and back every 0.3 s. */
function wandering(seconds: number, startT = 0): PitchFrame[] {
  const parts = Array.from(
    { length: Math.round(seconds / 0.3) },
    (_, i) => (t: number) => tone(i % 2 === 0 ? 55 : 59, 0.3, { startT: t }),
  )
  return sequence(...parts).map((frame) => ({ ...frame, t: frame.t + startT }))
}

/** The frames, counting each one read: the work a settle pass does. */
function counted(frames: PitchFrame[]): {
  frames: PitchFrame[]
  reads: () => number
} {
  let reads = 0
  const watched = new Proxy(frames, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1
      return Reflect.get(target, key, receiver) as unknown
    },
  })
  return { frames: watched, reads: () => reads }
}

describe('settleLiveNote', () => {
  it('names a note held still long enough', () => {
    const midi = settleLiveNote(tone(57, ENOUGH))
    expect(midi).not.toBeNull()
    expect(Math.round(midi ?? 0)).toBe(57)
  })

  it('waits while the note is still short', () => {
    expect(settleLiveNote(tone(57, SETTLE_SECONDS))).toBeNull()
  })

  it('does not name a slide', () => {
    // A third up across the take: never still for long enough.
    const slide = sequence(
      (t) => tone(55, 0.3, { startT: t }),
      (t) => tone(57, 0.3, { startT: t }),
      (t) => tone(59, 0.3, { startT: t }),
    )
    expect(settleLiveNote(slide)).toBeNull()
  })

  it('reads only the latest run after a silence', () => {
    const frames = sequence(
      (t) => tone(50, ENOUGH, { startT: t }),
      (t) => silence(0.5, t),
      (t) => tone(62, 0.4, { startT: t }),
    )
    // The new run is too short to name, and the old one is over.
    expect(settleLiveNote(frames)).toBeNull()
  })

  it('reads the last moments of the take, however long it has gone on', () => {
    // Review A of PR 973, m3, and review B, minor 1: every frame of the
    // listen re-read the whole capture, so the work grew with the wait.
    const minute = counted(wandering(60))
    const fiveMinutes = counted(wandering(300))
    expect(settleLiveNote(minute.frames)).toBeNull()
    expect(settleLiveNote(fiveMinutes.frames)).toBeNull()
    expect(fiveMinutes.reads()).toBeLessThan(150)
    expect(Math.abs(fiveMinutes.reads() - minute.reads())).toBeLessThan(10)

    // A long quiet after the voice costs a glance at each quiet frame.
    const quiet = counted([...wandering(60), ...silence(240, 60)])
    expect(settleLiveNote(quiet.frames)).toBeNull()
    expect(quiet.reads()).toBeLessThan(240 * 60 + 150)
  })

  it('still names a note held after a long wander, and one held all along', () => {
    // The voice runs on from the wander into the note: named once the
    // note has sat still for SETTLE_SECONDS, and not two frames before.
    const wander = wandering(120)
    const still = Math.round(SETTLE_SECONDS * 60)
    const afterWander = [...wander, ...tone(57, 1, { startT: 120 })]
    expect(
      settleLiveNote(afterWander.slice(0, wander.length + still - 2)),
    ).toBeNull()
    expect(
      Math.round(
        settleLiveNote(afterWander.slice(0, wander.length + still + 3)) ?? 0,
      ),
    ).toBe(57)
    // A note held from long before the last moments.
    expect(Math.round(settleLiveNote(tone(62, 40)) ?? 0)).toBe(62)
    // And one that ended a breath ago.
    const ended = [...tone(50, ENOUGH), ...silence(3, ENOUGH)]
    expect(Math.round(settleLiveNote(ended) ?? 0)).toBe(50)
  })

  it('names nothing in silence', () => {
    expect(settleLiveNote(silence(2, 0))).toBeNull()
  })
})
