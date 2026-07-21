// ============================================================
// Zen-mode navigation helpers — unit tests
// ============================================================
//
// Covers the EARS requirements in docs/specs/zen-navigation.ears.md
// (REQ-ZEN-001..006): the back-button seek-vs-prev decision, library ordering,
// prev/next neighbours, and the autoplay-on-end target.

import { describe, expect, it } from 'vitest'
import type { LibrarySessionLike } from '@/features/stem-mixer/zen-navigation'
import { autoAdvanceTarget, nextSessionId, orderedLibrarySessions, prevSessionId, relativeSessionId, resolveBackIntent, SEEK_TO_START_THRESHOLD_SEC, } from '@/features/stem-mixer/zen-navigation'

// ── resolveBackIntent (REQ-ZEN-001 / 002) ──────────────────────

describe('resolveBackIntent', () => {
  it('REQ-ZEN-001: past the threshold, a first press seeks to start', () => {
    // Mid-song: the back control restarts the current song.
    expect(resolveBackIntent(42, true)).toBe('seek-start')
    expect(resolveBackIntent(SEEK_TO_START_THRESHOLD_SEC + 0.01, true)).toBe(
      'seek-start',
    )
  })

  it('REQ-ZEN-002: near the start with a previous item, jumps to previous', () => {
    // The seek-to-start left the position at ~0, so the next press goes back.
    expect(resolveBackIntent(0, true)).toBe('prev')
    expect(resolveBackIntent(1.5, true)).toBe('prev')
    // The threshold itself still counts as "near the start" (inclusive).
    expect(resolveBackIntent(SEEK_TO_START_THRESHOLD_SEC, true)).toBe('prev')
  })

  it('REQ-ZEN-002: near the start with no previous item, still seeks to start', () => {
    // First library song / start of a playlist: back is a harmless re-seek.
    expect(resolveBackIntent(0, false)).toBe('seek-start')
    expect(resolveBackIntent(1, false)).toBe('seek-start')
  })

  it('REQ-ZEN-002: models the two-click sequence from mid-song', () => {
    // 1st click at 30s -> seek to start (position becomes ~0).
    expect(resolveBackIntent(30, true)).toBe('seek-start')
    // 2nd click, now near the start -> previous item.
    expect(resolveBackIntent(0.2, true)).toBe('prev')
  })

  it('honours a custom threshold', () => {
    expect(resolveBackIntent(4, true, 5)).toBe('prev')
    expect(resolveBackIntent(6, true, 5)).toBe('seek-start')
  })
})

// ── orderedLibrarySessions (REQ-ZEN-003) ───────────────────────

const DEMO = 'demo-session'

function makeSession(
  over: Partial<LibrarySessionLike> & { sessionId: string },
): LibrarySessionLike {
  return {
    status: 'completed',
    createdAt: 0,
    outputs: { vocal: 'blob:x' },
    ...over,
  }
}

describe('orderedLibrarySessions', () => {
  it('REQ-ZEN-003: keeps completed songs with audio, newest first', () => {
    const sessions = [
      makeSession({ sessionId: 'a', createdAt: 100 }),
      makeSession({ sessionId: 'b', createdAt: 300 }),
      makeSession({ sessionId: 'c', createdAt: 200 }),
    ]
    expect(
      orderedLibrarySessions(sessions, DEMO).map((s) => s.sessionId),
    ).toEqual(['b', 'c', 'a'])
  })

  it('REQ-ZEN-003: excludes the demo, unfinished, and audio-less sessions', () => {
    const sessions = [
      makeSession({ sessionId: 'keep', createdAt: 5 }),
      makeSession({ sessionId: DEMO, createdAt: 9 }),
      makeSession({ sessionId: 'pending', status: 'processing', createdAt: 8 }),
      makeSession({
        sessionId: 'noaudio',
        createdAt: 7,
        outputs: undefined,
        stemMeta: undefined,
      }),
      // Audio recoverable from stemMeta alone still counts.
      makeSession({
        sessionId: 'meta',
        createdAt: 6,
        outputs: undefined,
        stemMeta: { ok: true },
      }),
    ]
    expect(
      orderedLibrarySessions(sessions, DEMO).map((s) => s.sessionId),
    ).toEqual(['meta', 'keep'])
  })
})

// ── prev / next neighbours (REQ-ZEN-004 / 005) ─────────────────

describe('prev/next session ids', () => {
  const ids = ['s1', 's2', 's3']

  it('REQ-ZEN-005: next returns the following id, null at the end', () => {
    expect(nextSessionId(ids, 's1')).toBe('s2')
    expect(nextSessionId(ids, 's2')).toBe('s3')
    expect(nextSessionId(ids, 's3')).toBeNull()
  })

  it('REQ-ZEN-004: prev returns the preceding id, null at the start', () => {
    expect(prevSessionId(ids, 's3')).toBe('s2')
    expect(prevSessionId(ids, 's2')).toBe('s1')
    expect(prevSessionId(ids, 's1')).toBeNull()
  })

  it('returns null for an unknown or undefined current id', () => {
    expect(nextSessionId(ids, 'nope')).toBeNull()
    expect(prevSessionId(ids, 'nope')).toBeNull()
    expect(nextSessionId(ids, undefined)).toBeNull()
    expect(prevSessionId(ids, undefined)).toBeNull()
  })

  it('relativeSessionId steps by an arbitrary offset', () => {
    expect(relativeSessionId(ids, 's1', 2)).toBe('s3')
    expect(relativeSessionId(ids, 's1', 3)).toBeNull()
  })
})

// ── autoAdvanceTarget (REQ-ZEN-006) ────────────────────────────

describe('autoAdvanceTarget', () => {
  const ids = ['s1', 's2', 's3']

  it('REQ-ZEN-006: off -> never advances', () => {
    expect(autoAdvanceTarget(false, ids, 's1')).toBeNull()
  })

  it('REQ-ZEN-006: on with a next song -> that song', () => {
    expect(autoAdvanceTarget(true, ids, 's1')).toBe('s2')
    expect(autoAdvanceTarget(true, ids, 's2')).toBe('s3')
  })

  it('REQ-ZEN-006: on at the last song -> null (nothing to advance to)', () => {
    expect(autoAdvanceTarget(true, ids, 's3')).toBeNull()
  })
})
