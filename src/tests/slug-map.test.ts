// ============================================================
// Exercise deep-link slug map tests
// ============================================================
// Guards the marketing deep-link contract (`/exercises/<slug>`): the path
// matcher and the slug → launch-intent registry the about-landing relies on.

import { describe, expect, it } from 'vitest'
import { EXERCISE_SLUG_PATH, EXERCISE_SLUGS, } from '@/features/exercises/slug-map'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import { TAB_JAM, TAB_KARAOKE } from '@/features/tabs/constants'

// ── EXERCISE_SLUG_PATH ────────────────────────────────────────

describe('EXERCISE_SLUG_PATH', () => {
  it('matches /exercises/<slug> and captures the slug', () => {
    expect('/exercises/perfect-octave'.match(EXERCISE_SLUG_PATH)?.[1]).toBe(
      'perfect-octave',
    )
    // Trailing slash is allowed.
    expect('/exercises/speed-scales/'.match(EXERCISE_SLUG_PATH)?.[1]).toBe(
      'speed-scales',
    )
    // An unknown but well-formed slug still matches (handled as "not found").
    expect('/exercises/nope'.match(EXERCISE_SLUG_PATH)?.[1]).toBe('nope')
  })

  it('rejects non-matching paths', () => {
    expect('/exercises'.match(EXERCISE_SLUG_PATH)).toBeNull()
    expect('/exercises/'.match(EXERCISE_SLUG_PATH)).toBeNull()
    expect('/exercises/Bad-Slug'.match(EXERCISE_SLUG_PATH)).toBeNull() // uppercase
    expect('/exercises/a_b'.match(EXERCISE_SLUG_PATH)).toBeNull() // underscore
    expect('/exercises/a/b'.match(EXERCISE_SLUG_PATH)).toBeNull() // nested
    expect('/foo/perfect-octave'.match(EXERCISE_SLUG_PATH)).toBeNull()
  })
})

// ── EXERCISE_SLUGS registry ───────────────────────────────────

describe('EXERCISE_SLUGS', () => {
  it('maps the four landing slugs to the agreed launch intents', () => {
    expect(EXERCISE_SLUGS['perfect-octave']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_INTERVAL_TRAINER,
      notes: ['C4', 'C5'],
    })
    expect(EXERCISE_SLUGS['speed-scales']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      scaleId: 'scale-major-c4',
      difficulty: 8,
    })
    expect(EXERCISE_SLUGS['karaoke-duel']).toEqual({
      kind: 'tab',
      tab: TAB_KARAOKE,
    })
    expect(EXERCISE_SLUGS['jam-relay']).toEqual({ kind: 'tab', tab: TAB_JAM })
  })

  it('keys are lowercase kebab-case', () => {
    for (const slug of Object.keys(EXERCISE_SLUGS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('every launch has a coherent shape', () => {
    for (const launch of Object.values(EXERCISE_SLUGS)) {
      if (launch.kind === 'exercise') {
        expect(typeof launch.exercise).toBe('string')
        // A launch targets the exercise via either explicit notes or a scaleId
        // (or neither, falling back to the exercise's own default).
        if (launch.notes !== undefined) {
          expect(launch.notes.length).toBeGreaterThan(0)
        }
      } else {
        expect(launch.kind).toBe('tab')
        expect(typeof launch.tab).toBe('string')
      }
    }
  })

  it('unknown slugs resolve to undefined (own-property only)', () => {
    expect(EXERCISE_SLUGS['does-not-exist']).toBeUndefined()
    // Prototype keys must not leak through as launch intents.
    expect(Object.hasOwn(EXERCISE_SLUGS, 'constructor')).toBe(false)
  })
})
