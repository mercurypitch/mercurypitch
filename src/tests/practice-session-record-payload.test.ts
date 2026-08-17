// ============================================================
// The multi-item session payload passes the worker's own gate
// ============================================================
//
// Repro: signed in, finishing ANY built-in session template credited
// nothing — no session row, no minutes, no streak, no badges. One result is
// banked per item-repeat, but the payload's denominator counted items, so
// warmup-2min posted notesHit 24 against notesTotal 5. `validateWrite`
// rejects notesHit > notesTotal, the create came back 400, and
// `saveSessionRecord`'s catch swallowed it by design — a silent, total loss
// for the whole run.
//
// This is the same shape as the plain-drill loss in CLAUDE-JOURNEY-007
// (exercise-record-payload.test.ts); that fix pinned the drill payload and
// left the session payload unpinned. This closes the other half, with the
// production builder and the production validator — no copies of either.

import { describe, expect, it } from 'vitest'
import { PRACTICE_SESSIONS } from '@/data/sessions'
import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { practiceSessionPayload } from '@/stores/practice-session-store'
import type { PlaybackSession, PracticeResult, SessionItem } from '@/types'
import { validateWrite } from '../../workers/db-worker/src/validation'

/** One banked result, as useSessionSequencer records it per scored repeat. */
function result(score: number): PracticeResult {
  return {
    score,
    noteCount: 8,
    avgCents: 12,
    itemsCompleted: 1,
    name: 'item',
    mode: PLAYBACK_MODE_SESSION,
    completedAt: 1,
    noteResult: [],
  }
}

/** Every repeat of every non-rest item completed — a full, honest run. */
function fullRun(session: PlaybackSession): PracticeResult[] {
  const runs = session.items.reduce(
    (total, item) => total + (item.type === 'rest' ? 0 : (item.repeat ?? 1)),
    0,
  )
  return Array.from({ length: runs }, () => result(80))
}

function sessionOf(items: SessionItem[]): PlaybackSession {
  return { id: 's1', name: 'Session', items } as PlaybackSession
}

function item(over: Partial<SessionItem>): SessionItem {
  return {
    id: 'i1',
    type: 'melody',
    startBeat: 0,
    label: 'Item',
    ...over,
  } as SessionItem
}

describe('the multi-item session payload', () => {
  it('is accepted by the worker validation that rejected every template', () => {
    // The field repro: all six built-ins use repeat 8/12/15, so all six were
    // rejected. Driving the real templates keeps this honest if they change.
    expect(PRACTICE_SESSIONS.length).toBeGreaterThan(0)
    for (const template of PRACTICE_SESSIONS) {
      const session = sessionOf(template.items)
      const payload = practiceSessionPayload(session, fullRun(session))
      expect(validateWrite('sessionRecords', payload)).toBeNull()
    }
  })

  it('counts the denominator in repeats, the same unit as the numerator', () => {
    // warmup-2min is the exact row from the repro: 8 + 8 + 8 scored repeats.
    const session = sessionOf([
      item({ id: 'a', repeat: 8 }),
      item({ id: 'b', type: 'rest', repeat: 1, restMs: 2000 }),
      item({ id: 'c', repeat: 8 }),
    ])
    const payload = practiceSessionPayload(session, fullRun(session))
    expect(payload.notesHit).toBe(16)
    expect(payload.notesTotal).toBe(16)
  })

  it('leaves a partial run partial, rather than flattering it', () => {
    const session = sessionOf([item({ id: 'a', repeat: 8 })])
    const payload = practiceSessionPayload(session, [result(70), result(90)])
    expect(payload.notesHit).toBe(2)
    expect(payload.notesTotal).toBe(8)
    expect(validateWrite('sessionRecords', payload)).toBeNull()
  })

  it('treats an absent repeat as one run', () => {
    const session = sessionOf([item({ id: 'a' }), item({ id: 'b' })])
    const payload = practiceSessionPayload(session, fullRun(session))
    expect(payload.notesTotal).toBe(2)
  })

  it('still posts a valid write if a walk outruns its own schedule', () => {
    // Defence in depth: the numerator can never re-open the 400, whatever
    // a future sequencer change does to the walk.
    const session = sessionOf([item({ id: 'a', repeat: 2 })])
    const payload = practiceSessionPayload(session, [
      result(70),
      result(80),
      result(90),
    ])
    expect(payload.notesTotal).toBe(3)
    expect(validateWrite('sessionRecords', payload)).toBeNull()
  })

  it('reports the mean score, and marks the run as free practice', () => {
    const session = sessionOf([item({ id: 'a', repeat: 3 })])
    const payload = practiceSessionPayload(session, [
      result(70),
      result(81),
      result(92),
    ])
    expect(payload.score).toBe(81)
    expect(payload.accuracy).toBe(81)
    // 'practice' is the eligibility key the leaderboard reads; a session over
    // a self-chosen melody is history, never a ranked run.
    expect(payload.source).toBe('practice')
    expect(payload.melodyName).toBe('Session')
  })
})
