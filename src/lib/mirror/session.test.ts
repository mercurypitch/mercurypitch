// ============================================================
// Voice Mirror session state machine — flow ordering, target
// picking from the detected range, and the one-free-retry rule.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { F0Frame } from './metrics'
import type { MirrorSessionState } from './session'
import { initialSessionState, MATCH_NOTE_COUNT, reduceSession } from './session'

const HOP = 0.016
const centsToHz = (cents: number): number => 440 * 2 ** ((cents - 6900) / 1200)

function tone(midi: number, durationSec: number): F0Frame[] {
  return Array.from({ length: Math.round(durationSec / HOP) }, (_, i) => ({
    t: i * HOP,
    f0: centsToHz(midi * 100),
    conf: 0.95,
  }))
}

function glide(fromMidi: number, toMidi: number): F0Frame[] {
  const frames: F0Frame[] = []
  const total = 8
  for (let t = 0; t < total; t += HOP) {
    const hold = 0.4
    const progress = Math.min(1, Math.max(0, (t - hold) / (total - 2 * hold)))
    const midi = fromMidi + (toMidi - fromMidi) * progress
    frames.push({ t, f0: centsToHz(midi * 100), conf: 0.95 })
  }
  return frames
}

const silence = (durationSec: number): F0Frame[] =>
  Array.from({ length: Math.round(durationSec / HOP) }, (_, i) => ({
    t: i * HOP,
    f0: 0,
    conf: 0,
  }))

const rng = (): (() => number) => {
  let state = 42
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

/** Drive a session through mic grant + both glides + hold. */
function toMatchPhase(): MirrorSessionState {
  const random = rng()
  let s = initialSessionState()
  s = reduceSession(s, { type: 'start' }, random)
  s = reduceSession(s, { type: 'mic-granted' }, random)
  s = reduceSession(s, { type: 'glide-done', frames: glide(43, 67) }, random)
  s = reduceSession(s, { type: 'glide-done', frames: glide(67, 43) }, random)
  s = reduceSession(s, { type: 'hold-done', frames: tone(55, 6) }, random)
  return s
}

describe('reduceSession flow', () => {
  it('walks idle → mic → glide-up → glide-down → hold → match', () => {
    let s = initialSessionState()
    expect(s.phase).toBe('idle')
    s = reduceSession(s, { type: 'start' })
    expect(s.phase).toBe('mic')
    s = reduceSession(s, { type: 'mic-granted' })
    expect(s.phase).toBe('glide-up')
    s = reduceSession(s, { type: 'glide-done', frames: glide(43, 67) })
    expect(s.phase).toBe('glide-down')
    s = reduceSession(s, { type: 'glide-done', frames: glide(67, 43) })
    expect(s.phase).toBe('hold')
    s = reduceSession(s, { type: 'hold-done', frames: tone(55, 6) })
    expect(s.phase).toBe('match')
    expect(s.targets).toHaveLength(MATCH_NOTE_COUNT)
  })

  it('routes mic denial to mic-denied and lets a re-grant recover', () => {
    let s = reduceSession(initialSessionState(), { type: 'start' })
    s = reduceSession(s, { type: 'mic-denied' })
    expect(s.phase).toBe('mic-denied')
    s = reduceSession(s, { type: 'mic-granted' })
    expect(s.phase).toBe('glide-up')
  })

  it('ignores events that do not apply to the current phase', () => {
    const s = initialSessionState()
    expect(reduceSession(s, { type: 'hold-done', frames: [] })).toEqual(s)
    expect(reduceSession(s, { type: 'mic-granted' })).toEqual(s)
  })

  it('picks match targets inside the detected range', () => {
    const s = toMatchPhase()
    for (const target of s.targets) {
      expect(target).toBeGreaterThanOrEqual(43)
      expect(target).toBeLessThanOrEqual(67)
    }
  })

  it('falls back to default targets when the glides were silent', () => {
    const random = rng()
    let s = initialSessionState()
    s = reduceSession(s, { type: 'start' }, random)
    s = reduceSession(s, { type: 'mic-granted' }, random)
    s = reduceSession(s, { type: 'glide-done', frames: silence(8) }, random)
    s = reduceSession(s, { type: 'glide-done', frames: silence(8) }, random)
    s = reduceSession(s, { type: 'hold-done', frames: tone(55, 6) }, random)
    expect(s.phase).toBe('match')
    expect(s.targets).toHaveLength(MATCH_NOTE_COUNT)
  })
})

describe('match takes and retries', () => {
  it('completes five good takes and lands on results with a full result', () => {
    let s = toMatchPhase()
    for (let i = 0; i < MATCH_NOTE_COUNT; i++) {
      expect(s.phase).toBe('match')
      expect(s.matchIndex).toBe(i)
      s = reduceSession(s, {
        type: 'match-done',
        frames: tone(s.targets[i], 3),
      })
    }
    expect(s.phase).toBe('results')
    expect(s.matches).toHaveLength(MATCH_NOTE_COUNT)
    expect(s.result?.accuracy?.score).toBe(100)
    expect(s.result?.range?.lowNote).toBe('G2')
    expect(s.result?.steadiness).not.toBeNull()
  })

  it('offers one free retry on a silent take, then keeps the zero', () => {
    let s = toMatchPhase()
    s = reduceSession(s, { type: 'match-done', frames: silence(3) })
    // First silent take: retry, same note.
    expect(s.matchIndex).toBe(0)
    expect(s.matches).toHaveLength(0)
    expect(s.retriesUsed).toBe(1)
    // Second silent take: the zero is kept and we move on.
    s = reduceSession(s, { type: 'match-done', frames: silence(3) })
    expect(s.matchIndex).toBe(1)
    expect(s.matches).toHaveLength(1)
    expect(s.retriesUsed).toBe(0)
  })

  it('does not consume the retry on a voiced take', () => {
    let s = toMatchPhase()
    s = reduceSession(s, { type: 'match-done', frames: tone(s.targets[0], 3) })
    expect(s.matchIndex).toBe(1)
    expect(s.retriesUsed).toBe(0)
  })

  it('reset returns to a clean idle state', () => {
    const s = reduceSession(toMatchPhase(), { type: 'reset' })
    expect(s).toEqual(initialSessionState())
  })
})
