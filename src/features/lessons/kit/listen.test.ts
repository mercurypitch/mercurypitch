// ============================================================
// Take timing tests — when a take is over, on the frames' own clock
// ============================================================
//
// `takeOver` decides when a take ends: no voice in time, its run done, or,
// with `quiet`, the voice stopped. Lesson 7's siren adds `quietAfter`: a
// silence ends the take only once two seconds of voice have been heard
// (its WEB-SPEC, Toys 4, state 6). Without it every take ends as before.

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { TakeOptions } from './listen'
import { takeOver } from './listen'

const HOP = 0.016

/** Frames from 0 to `end` seconds, voiced where `sung(t)` says. */
function frames(end: number, sung: (t: number) => boolean): F0Frame[] {
  const out: F0Frame[] = []
  for (let i = 0; i * HOP < end; i++) {
    const t = i * HOP
    out.push({ t, f0: sung(t) ? 220 : 0, conf: sung(t) ? 0.95 : 0 })
  }
  return out
}

const SIREN: TakeOptions = {
  wait: 6,
  run: 10,
  quiet: 1,
  quietAfter: 2,
  cancelled: () => false,
}

describe('takeOver', () => {
  it('waits up to `wait` seconds for a voice, then ends', () => {
    const silent = frames(3, () => false)
    expect(takeOver(silent, null, 5.9, SIREN)).toBe(false)
    expect(takeOver(silent, null, 6, SIREN)).toBe(true)
  })

  it('ends a siren after a second of quiet once two seconds of voice were heard', () => {
    // Arrange: 2.5 s of voice from 0.5 s, then quiet
    const sung = (t: number): boolean => t >= 0.5 && t < 3
    // Act and Assert: 0.9 s of quiet goes on, 1.1 s ends it
    expect(takeOver(frames(3.9, sung), 0.5, 3.9, SIREN)).toBe(false)
    expect(takeOver(frames(4.1, sung), 0.5, 4.1, SIREN)).toBe(true)
  })

  it('keeps a siren open through a breath before two seconds of voice', () => {
    // Arrange: 1.5 s of voice, then 1.5 s of quiet
    const sung = (t: number): boolean => t >= 0.5 && t < 2
    // Act and Assert
    expect(takeOver(frames(3.5, sung), 0.5, 3.5, SIREN)).toBe(false)
  })

  it('ends a siren at ten seconds from its first voiced frame, voice or none', () => {
    const always = (): boolean => true
    expect(takeOver(frames(10.4, always), 0.5, 10.4, SIREN)).toBe(false)
    expect(takeOver(frames(10.6, always), 0.5, 10.6, SIREN)).toBe(true)
  })

  it('without quietAfter, ends on any quiet as before', () => {
    // Arrange: Lesson 5's hold, one second of quiet
    const hold: TakeOptions = { ...SIREN, quietAfter: undefined }
    const sung = (t: number): boolean => t >= 0.5 && t < 2
    // Act and Assert
    expect(takeOver(frames(3.1, sung), 0.5, 3.1, hold)).toBe(true)
  })

  it('without quiet, always runs its whole run', () => {
    const run: TakeOptions = { wait: 6, run: 3, cancelled: () => false }
    const sung = (t: number): boolean => t >= 0.5 && t < 1
    expect(takeOver(frames(3.4, sung), 0.5, 3.4, run)).toBe(false)
    expect(takeOver(frames(3.6, sung), 0.5, 3.6, run)).toBe(true)
  })
})
