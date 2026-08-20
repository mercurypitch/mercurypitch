// ============================================================
// What actually gets banked, and what the Progress card does with it
// ============================================================
//
// Written while diagnosing "I did a few sessions on the singing tab with my
// mic on and the Progress card still reads 0 sessions". It pinned the gap;
// #626 then closed it. What is left is the half that is still true and was
// never covered anywhere else: the banking rules in `endPracticeSession`,
// exercised through the real store rather than a fixture, and the card read
// through the same device-scope path the app uses when nobody is signed in.
//
// The one test that inverted is the most valuable one here. It used to
// assert that a banked session with no per-note detail was *hidden* by the
// card. That was the bug. It now asserts the opposite, from the real store.

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

import { loadProgressRuns } from '@/features/progress/progress-runs'
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

/**
 * Render the card the way a signed-out visitor gets it: runs derived from
 * this device's history by the real loader, not by a fixture. That path is
 * the whole point — reading the history straight into the card is what
 * counted the chart's input and produced the zero.
 */
async function renderCardFromHistory(): Promise<void> {
  const source = await loadProgressRuns({
    signedIn: () => false,
    localHistory: () => getSessionHistory(),
  })
  render(() => (
    <TrendsCard
      sessions={getSessionHistory()}
      runs={source.runs}
      scope={source.scope}
      streak={null}
    />
  ))
}

function tile(label: string): HTMLElement | null {
  return screen.getByText(label).parentElement
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionResults([])
  setPracticeResults([])
  setPracticeSession(null)
})

afterEach(cleanup)

describe('what endPracticeSession banks', () => {
  it('banks a session that completed at least one scored item', () => {
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(72))

    expect(endPracticeSession()).not.toBeNull()
    expect(getSessionHistory()).toHaveLength(1)
  })

  it('banks nothing at all from a play-then-stop run', () => {
    // Starting playback and stopping without any item completing to a score
    // leaves `practiceResults` empty, and `endPracticeSession` deliberately
    // records nothing rather than banking a zero — a rule that stops score-0
    // runs dragging the profile and the leaderboard down.
    //
    // Correct on its own terms, and still completely unexplained on screen.
    setPracticeSession(aSession())

    expect(endPracticeSession()).toBeNull()
    expect(getSessionHistory()).toEqual([])
  })

  it('banks nothing when there was no practice session to end', () => {
    // Free play on the singing tab. There is no session object, so there is
    // no session to record — pressing stop here can never move the card.
    expect(endPracticeSession()).toBeNull()
    expect(getSessionHistory()).toEqual([])
  })
})

describe('the Progress card, reading what was banked', () => {
  it('reads a true zero when nothing has been banked', async () => {
    await renderCardFromHistory()

    expect(tile('Runs')).toHaveTextContent('0')
    expect(
      screen.getByText('One more session and your score trend appears here.'),
    ).toBeInTheDocument()
  })

  it('counts a banked session and takes its score', async () => {
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(72))
    endPracticeSession()

    await renderCardFromHistory()

    expect(tile('Runs')).toHaveTextContent('1')
    expect(tile('Best score')).toHaveTextContent('72%')
  })

  it('counts a banked session that carries no per-note results', async () => {
    // THE BUG THIS FILE WAS OPENED FOR, now the other way round. The session
    // is recorded, it counts for streaks and badges — and the card used to
    // filter it out and read zero, because the tile was really counting
    // "sessions with usable per-note pitch data".
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItemWithoutNotes(72))
    endPracticeSession()

    expect(getSessionHistory()).toHaveLength(1)
    await renderCardFromHistory()

    expect(tile('Runs')).toHaveTextContent('1')
    expect(tile('Best score')).toHaveTextContent('72%')
    // The chart still honestly has nothing to draw. That is the distinction
    // the count is no longer allowed to inherit.
    expect(
      screen.getByText('One more session and your score trend appears here.'),
    ).toBeInTheDocument()
  })

  it('draws the trend from the second banked session with note detail on', async () => {
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(60))
    endPracticeSession()
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(80))
    endPracticeSession()

    await renderCardFromHistory()

    expect(tile('Runs')).toHaveTextContent('2')
    expect(
      screen.queryByText('One more session and your score trend appears here.'),
    ).not.toBeInTheDocument()
  })

  it('says these runs are this device’s, since nobody is signed in', async () => {
    setPracticeSession(aSession())
    recordSessionItemResult(aScoredItem(50))
    endPracticeSession()

    await renderCardFromHistory()

    expect(screen.getByText(/on this device only/i)).toBeInTheDocument()
  })
})
