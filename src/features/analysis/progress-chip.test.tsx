// ============================================================
// The Vocal Analysis "Progress" chip, and what actually fills it
// ============================================================
//
// Reported: "I did a few sessions on the singing tab with my mic on and the
// Progress card still reads 0 sessions." These tests establish what the card
// is wired to, so the gap is written down rather than argued about.
//
// The card reads `getSessionHistory()` — the localStorage-backed
// `sessionResults` signal — which has exactly ONE production writer:
// `endPracticeSession`. Everything else that a singer would call "a session"
// (exercises, challenges, weekly attempts) writes a cloud `sessionRecord`
// instead and never touches this signal.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackSession, PracticeResult } from '@/types'

const mocks = vi.hoisted(() => ({
  saveSessionRecord: vi.fn(async () => null),
  checkAndGrantBadges: vi.fn(async () => undefined),
}))

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: mocks.saveSessionRecord,
}))
vi.mock('@/db/services/grant-service', () => ({
  checkAndGrantBadges: mocks.checkAndGrantBadges,
}))

import { endPracticeSession, getSessionHistory, recordSessionItemResult, setPracticeResults, setPracticeSession, setSessionResults, } from '@/stores/practice-session-store'
import { TrendsCard } from './sections'

function aSession(): PlaybackSession {
  return {
    id: 'session-1',
    name: 'Default warmup',
    deletable: false,
    items: [
      { type: 'melody', id: 'm1', repeat: 1 },
      { type: 'melody', id: 'm2', repeat: 1 },
    ] as PlaybackSession['items'],
    created: Date.now(),
  }
}

/** One scored item carrying per-note pitch results, as a sung repeat does. */
function aScoredItem(score: number, notes = 4): PracticeResult {
  return {
    score,
    noteCount: notes,
    avgCents: 12,
    itemsCompleted: 1,
    name: 'Default warmup',
    mode: 'once',
    completedAt: Date.now(),
    noteResult: Array.from({ length: notes }, () => ({
      item: {
        id: 0,
        note: { midi: 60, name: 'C', octave: 4, freq: 261 },
        duration: 1,
        startBeat: 0,
      },
      pitchFreq: 261,
      pitchCents: 12,
      time: 100,
      rating: 'good' as const,
      avgCents: 12,
      targetNote: 'C4',
    })),
  } as unknown as PracticeResult
}

/** The same scored item with no per-note detail behind it. */
function aScoredItemWithoutNotes(score: number): PracticeResult {
  return { ...aScoredItem(score), noteResult: [] } as PracticeResult
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionResults([])
  setPracticeResults([])
  setPracticeSession(null)
})

afterEach(cleanup)

describe('the Progress card', () => {
  it('reads zero when nothing has been banked', () => {
    render(() => <TrendsCard sessions={getSessionHistory()} streak={null} />)

    expect(
      screen.getByText('Sessions').previousElementSibling,
    ).toHaveTextContent('0')
    expect(
      screen.getByText('One more session and your score trend appears here.'),
    ).toBeInTheDocument()
  })

  it('counts a practice session that banked at least one scored item', () => {
    // The path that works: session mode, an item completes with a score, and
    // ending the session writes it to the signal the card reads.
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(72))

    expect(endPracticeSession()).not.toBeNull()

    render(() => <TrendsCard sessions={getSessionHistory()} streak={null} />)
    expect(
      screen.getByText('Sessions').previousElementSibling,
    ).toHaveTextContent('1')
    expect(
      screen.getByText('Best score').previousElementSibling,
    ).toHaveTextContent('72%')
  })

  it('draws the trend only from the second banked session onwards', () => {
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(60))
    endPracticeSession()
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(80))
    endPracticeSession()

    render(() => <TrendsCard sessions={getSessionHistory()} streak={null} />)
    expect(
      screen.getByText('Sessions').previousElementSibling,
    ).toHaveTextContent('2')
    expect(
      screen.queryByText('One more session and your score trend appears here.'),
    ).not.toBeInTheDocument()
  })

  it('banks nothing at all from a play-then-stop run', () => {
    // THE REPORTED SYMPTOM. Starting playback and stopping without any item
    // completing to a score leaves `practiceResults` empty, and
    // `endPracticeSession` deliberately records nothing rather than banking a
    // zero — a rule added to stop score-0 runs dragging the profile down.
    //
    // Correct on its own terms, and completely invisible: the singer sang,
    // heard themselves scored, pressed stop, and the card still reads 0 with
    // nothing on screen explaining why.
    setPracticeSession(aSession())

    expect(endPracticeSession()).toBeNull()

    render(() => <TrendsCard sessions={getSessionHistory()} streak={null} />)
    expect(
      screen.getByText('Sessions').previousElementSibling,
    ).toHaveTextContent('0')
  })

  it('hides a real banked session that carries no per-note results', () => {
    // THE BUG. The session IS recorded — history has it, and it counts for
    // streaks and badges — but the card filters it out and reads zero.
    //
    // `buildTrend` drops any session whose `buildPracticeMetrics` is null,
    // and that is null whenever the item has no `noteResult` entries. So a
    // tile labelled "Sessions" is really counting "sessions with usable
    // per-note pitch data". A singer whose runs bank without note detail
    // sees 0 forever, with nothing on screen to explain the difference.
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItemWithoutNotes(72))
    endPracticeSession()

    // Recorded: the history the rest of the app reads is not empty.
    expect(getSessionHistory()).toHaveLength(1)

    render(() => <TrendsCard sessions={getSessionHistory()} streak={null} />)
    // Shown: zero.
    expect(
      screen.getByText('Sessions').previousElementSibling,
    ).toHaveTextContent('0')
    expect(
      screen.getByText('Best score').previousElementSibling,
    ).toHaveTextContent('0%')
  })

  it('banks nothing when there was no practice session to end', () => {
    // Free play on the singing tab. There is no session object, so there is
    // no session to record — pressing stop here can never move the card.
    expect(endPracticeSession()).toBeNull()
    expect(getSessionHistory()).toEqual([])
  })
})
