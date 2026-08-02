// ============================================================
// Share identity
// ============================================================
//
// Nothing stopped the same melody being shared twenty times, so the
// Community shelf filled with identical cards and each duplicate cost a
// DB row. The guard is a content fingerprint, and it only works if it
// gets two judgement calls right: a rename is NOT a new melody, and two
// different melodies that share a title ARE different.

import { describe, expect, it } from 'vitest'
import { alreadyShared, fingerprintOf, melodyFingerprint, sessionFingerprint, } from '@/features/community/share-identity'
import type { MelodyItem } from '@/types'

const note = (n: string, duration = 1): MelodyItem =>
  ({ note: n, duration }) as unknown as MelodyItem

const SCALE = [note('C4'), note('D4'), note('E4'), note('F4')]

describe('fingerprintOf', () => {
  it('is stable across calls', () => {
    expect(fingerprintOf('hello')).toBe(fingerprintOf('hello'))
  })

  it('separates different input', () => {
    expect(fingerprintOf('hello')).not.toBe(fingerprintOf('hellp'))
  })

  it('is always an 8-character hex string', () => {
    for (const s of ['', 'a', 'a much longer string with spaces', '💥']) {
      expect(fingerprintOf(s)).toMatch(/^[0-9a-f]{8}$/)
    }
  })
})

describe('melodyFingerprint', () => {
  it('ignores the name — renaming is not re-composing', () => {
    // THE JUDGEMENT CALL. Keying on the title would let "Warm-up 2"
    // through as a brand new share of identical notes.
    const a = melodyFingerprint({ items: SCALE, bpm: 120, key: 'C' })
    const b = melodyFingerprint({ items: SCALE, bpm: 120, key: 'C' })
    expect(a).toBe(b)
  })

  it('separates different notes', () => {
    const changed = [...SCALE.slice(0, 3), note('G4')]
    expect(melodyFingerprint({ items: SCALE })).not.toBe(
      melodyFingerprint({ items: changed }),
    )
  })

  it('separates a different order of the same notes', () => {
    expect(melodyFingerprint({ items: SCALE })).not.toBe(
      melodyFingerprint({ items: [...SCALE].reverse() }),
    )
  })

  it('separates different durations', () => {
    expect(melodyFingerprint({ items: [note('C4', 1)] })).not.toBe(
      melodyFingerprint({ items: [note('C4', 2)] }),
    )
  })

  it('treats tempo, key and scale as part of the sound', () => {
    const base = { items: SCALE, bpm: 120, key: 'C', scale: 'major' }
    expect(melodyFingerprint(base)).not.toBe(
      melodyFingerprint({ ...base, bpm: 90 }),
    )
    expect(melodyFingerprint(base)).not.toBe(
      melodyFingerprint({ ...base, key: 'D' }),
    )
    expect(melodyFingerprint(base)).not.toBe(
      melodyFingerprint({ ...base, scale: 'minor' }),
    )
  })

  it('handles an empty melody without throwing', () => {
    expect(melodyFingerprint({ items: [] })).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('sessionFingerprint', () => {
  it('lets the same drill on a different day through', () => {
    // Two runs of one exercise are two real results; only republishing
    // the SAME run is the thing being stopped.
    const a = sessionFingerprint({
      name: 'Long Note',
      score: 80,
      completedAt: 1,
    })
    const b = sessionFingerprint({
      name: 'Long Note',
      score: 80,
      completedAt: 2,
    })
    expect(a).not.toBe(b)
  })

  it('matches the same run shared twice', () => {
    const run = { name: 'Long Note', score: 80, completedAt: 1000 }
    expect(sessionFingerprint(run)).toBe(sessionFingerprint({ ...run }))
  })

  it('separates different scores on the same timestamp', () => {
    expect(
      sessionFingerprint({ name: 'X', score: 70, completedAt: 1 }),
    ).not.toBe(sessionFingerprint({ name: 'X', score: 90, completedAt: 1 }))
  })
})

describe('alreadyShared', () => {
  it('finds a match', () => {
    expect(alreadyShared('abc', [{ shareFingerprint: 'abc' }])).toBe(true)
  })

  it('does not match a different fingerprint', () => {
    expect(alreadyShared('abc', [{ shareFingerprint: 'xyz' }])).toBe(false)
  })

  it('never blocks on cards shared before fingerprints existed', () => {
    // Legacy rows carry none. They must not swallow a new share, and an
    // undefined fingerprint must not match an undefined one.
    expect(alreadyShared('abc', [{}, {}])).toBe(false)
  })

  it('is false for an empty shelf', () => {
    expect(alreadyShared('abc', [])).toBe(false)
  })
})
