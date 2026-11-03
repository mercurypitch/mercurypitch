// ============================================================
// Session mode banks each item it finishes, and scores only a whole session
// ============================================================
//
// Repro: no Session-mode run was ever recorded. Each item was banked from the
// practice result signal, which only a single run's Stop sets and every Play
// clears, so through a session it was always empty: no item was banked, the
// session ended with nothing to average, and it left no record, no minutes,
// no streak and no summary, however it ended.
//
// Banked again, the average of the items sung would have scored a session
// stopped after one perfect item as a flawless one, the way a drill stopped
// after one round once did. So a session is scored only when it ran to its
// end without a skipped item. Any other session counts as practice: its time
// is credited and its score is not.
//
// The sequencer and the store here are the real ones, driven the way App
// drives them; only the network, the grant pass and the beacon are stand-ins.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { PracticeEngine } from '@/lib/practice-engine'
import { notifications, resetNotifications, startPracticeSession, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { endPracticeSession, getSessionHistory, markPracticeSessionLeft, SESSION_SKIPPED_LINE, SESSION_STOPPED_LINE, sessionCompleteLine, setSessionResults, } from '@/stores/practice-session-store'
import type { AccuracyRating, NoteResult, PlaybackSession, PracticeResult, SessionItem, } from '@/types'
import { useSessionSequencer } from './useSessionSequencer'

const mocks = vi.hoisted(() => ({
  saveSessionRecord: vi.fn(async (_data: Record<string, unknown>) => ({
    id: 'record-1',
  })),
  creditPracticeTime: vi.fn(async (_ms: number | undefined) => {}),
  checkAndGrantBadges: vi.fn(async () => undefined),
  trackEvent: vi.fn((_event: string) => {}),
}))

vi.mock('@/db/services/session-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  saveSessionRecord: mocks.saveSessionRecord,
  creditPracticeTime: mocks.creditPracticeTime,
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: mocks.checkAndGrantBadges,
}))
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  trackEvent: mocks.trackEvent,
}))

const MELODY = {
  id: 'melody-d',
  name: 'Warm-up in D',
  key: 'D',
  scaleType: 'major',
  bpm: 90,
  created: 0,
  items: [
    {
      id: 1,
      note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
      startBeat: 0,
      duration: 1,
    },
  ],
}

function melodyItem(id: string, label: string): SessionItem {
  return { id, type: 'melody', startBeat: 0, label, melodyId: MELODY.id }
}

function sessionOf(items: SessionItem[]): PlaybackSession {
  return {
    id: 'session-1',
    name: 'Two warm-ups',
    items,
    author: 'User',
    deletable: true,
    created: 0,
  } as PlaybackSession
}

/** Cents a sung note of each rating is off by. */
const CENTS: Record<AccuracyRating, number> = {
  perfect: 0,
  excellent: 8,
  good: 15,
  okay: 22,
  off: 80,
}

/** A note as the practice engine grades it; 'unsung' is one it heard no
 *  pitch for, which it writes as 'off' with 0 cents. */
function note(sung: AccuracyRating | 'unsung'): NoteResult {
  const rating = sung === 'unsung' ? 'off' : sung
  const cents = sung === 'unsung' ? 0 : CENTS[sung]
  return {
    item: {
      id: 0,
      note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
      duration: 1,
      startBeat: 0,
    },
    pitchFreq: sung === 'unsung' ? 0 : 293.66,
    pitchCents: cents,
    time: 500,
    rating,
    avgCents: cents,
    targetNote: 'D4',
  } as NoteResult
}

/** The practice engine's own grading, without the microphone it owns. */
const grade = (
  results: NoteResult[],
  name: string,
  mode: typeof PLAYBACK_MODE_SESSION,
): PracticeResult =>
  PracticeEngine.prototype.calculatePracticeResult.call(
    { calculateScore: PracticeEngine.prototype.calculateScore },
    results,
    name,
    mode,
  )

/**
 * A sequencer wired as App wires it: the item's notes come from the practice
 * controller, and its Stop ends the practice session.
 */
function sessionRun(session: PlaybackSession) {
  let notes: NoteResult[] = []
  const sequencer = useSessionSequencer({
    playbackRuntime: {
      stop: () => {},
      start: () => {},
      setMelody: () => {},
      setDurationBeats: () => {},
      getBPM: () => 120,
    } as never,
    practiceEngine: {
      resetSession: () => {},
      calculatePracticeResult: grade,
    } as never,
    noteResults: () => notes,
    setPitchHistory: (() => {}) as never,
    setNoteResults: ((next: NoteResult[]) => {
      notes = next
    }) as never,
    setLiveScore: (() => {}) as never,
    setPlaybackDisplayMelody: () => {},
    setPlaybackDisplayBeats: () => {},
    handleStop: async () => endPracticeSession(),
    handlePlay: () => {},
    setPlayMode: (() => {}) as never,
    closeSidebar: () => {},
    currentRepeat: () => 1,
    setCurrentRepeat: (() => {}) as never,
    repeatCycles: () => 1,
    buildScaleMelody: () => {},
    setCurrentBeat: (() => {}) as never,
    setCurrentNoteIndex: (() => {}) as never,
  })
  startPracticeSession(session)
  return {
    sequencer,
    /** The runtime plays the current item to its end, sung as `ratings`. */
    finishItem(ratings: (AccuracyRating | 'unsung')[]) {
      notes = ratings.map(note)
      sequencer.handleSessionItemComplete()
    },
    /** The current item is under way, its notes so far sung as `ratings`. */
    singing(ratings: (AccuracyRating | 'unsung')[]) {
      notes = ratings.map(note)
    },
  }
}

const shownLines = () => notifications().map((n) => n.message)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  mocks.saveSessionRecord.mockClear()
  mocks.creditPracticeTime.mockClear()
  mocks.trackEvent.mockClear()
  resetNotifications()
  setSessionResults([])
  melodyStore.restoreMelody(MELODY as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a session in Session mode', () => {
  it('records a session sung to its end, on the average of its items', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(30_000)
    run.finishItem(['perfect', 'perfect'])
    vi.advanceTimersByTime(30_000)
    run.finishItem(['off', 'off'])
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    const record = mocks.saveSessionRecord.mock.calls[0]![0]
    expect(record).toMatchObject({
      melodyName: 'Two warm-ups',
      score: 50,
      notesTotal: 2,
      durationMs: 60_000,
      source: 'practice',
    })
    expect(getSessionHistory()[0]).toMatchObject({
      sessionId: 'session-1',
      itemsCompleted: 2,
      score: 50,
    })
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('scores nothing from a session stopped after one perfect item, and credits its time', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(20_000)
    run.finishItem(['perfect', 'perfect'])
    vi.advanceTimersByTime(5_000)

    // The Stop button: the playback controller ends the practice session.
    expect(endPracticeSession()).toBeNull()
    expect(shownLines()).toContain(SESSION_STOPPED_LINE)
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(getSessionHistory()).toEqual([])
    expect(mocks.creditPracticeTime).toHaveBeenCalledWith(
      25_000,
      expect.anything(),
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('scores nothing from a session with a skipped item, though it ran to its end', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(10_000)
    run.sequencer.handleSessionSkip()
    vi.advanceTimersByTime(15_000)
    run.finishItem(['perfect', 'perfect'])
    // The last item's end stops the transport, which ends the session.
    await vi.advanceTimersByTimeAsync(0)
    expect(shownLines()).toContain(SESSION_SKIPPED_LINE)
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(getSessionHistory()).toEqual([])
    // Practice all the same: its time counts, and the funnel hears of it.
    expect(mocks.creditPracticeTime).toHaveBeenCalledWith(
      25_000,
      expect.anything(),
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('stays whole across a rest, which banks nothing', async () => {
    const rest: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Breathe',
      restMs: 2000,
    }
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), rest, melodyItem('i2', 'Second')]),
    )
    run.finishItem(['perfect'])
    run.finishItem([])
    run.finishItem(['perfect'])
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord.mock.calls[0]![0]).toMatchObject({
      score: 100,
      notesTotal: 2,
    })
    run.sequencer.destroy()
  })

  it('lands only the items that were sung, however their notes average', async () => {
    const run = sessionRun(
      sessionOf([
        melodyItem('i1', 'First'),
        melodyItem('i2', 'Second'),
        melodyItem('i3', 'Third'),
      ]),
    )
    run.finishItem(['perfect', 'perfect'])
    run.finishItem(['good', 'unsung'])
    // Nobody sang it: its notes read 0 cents, a dead-centre hit if counted.
    run.finishItem(['unsung', 'unsung'])
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord.mock.calls[0]![0]).toMatchObject({
      notesHit: 2,
      notesTotal: 3,
    })
    run.sequencer.destroy()
  })

  it('records nothing from a session played to its end with no note sung', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(30_000)
    run.finishItem(['unsung'])
    run.finishItem(['unsung', 'unsung'])
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(getSessionHistory()).toEqual([])
    expect(mocks.creditPracticeTime).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('only clears a session stopped before a note of it was sung', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(20_000)

    expect(endPracticeSession({ inFlightSung: false })).toBeNull()
    expect(shownLines()).toEqual([])
    await vi.runAllTimersAsync()

    expect(mocks.creditPracticeTime).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('credits a session stopped partway through its first item, once that was sung', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(20_000)

    // The item the Stop cut short banks nothing, but it was sung.
    expect(endPracticeSession({ inFlightSung: true })).toBeNull()
    expect(shownLines()).toContain(SESSION_STOPPED_LINE)
    await vi.runAllTimersAsync()

    expect(mocks.creditPracticeTime).toHaveBeenCalledWith(
      20_000,
      expect.anything(),
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('stays whole when a rest is skipped: there was nothing to sing in it', async () => {
    const rest: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Breathe',
      restMs: 2000,
    }
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), rest, melodyItem('i2', 'Second')]),
    )
    run.finishItem(['perfect'])
    run.sequencer.handleSessionSkip()
    run.finishItem(['perfect'])
    await vi.advanceTimersByTimeAsync(0)
    expect(shownLines()).not.toContain(SESSION_SKIPPED_LINE)
    expect(shownLines()).toContain(sessionCompleteLine(100))
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord.mock.calls[0]![0]).toMatchObject({
      score: 100,
    })
    run.sequencer.destroy()
  })

  it('scores a session stopped in its last rest, with every item sung', async () => {
    const rest: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Breathe',
      restMs: 2000,
    }
    const run = sessionRun(sessionOf([melodyItem('i1', 'First'), rest]))
    vi.advanceTimersByTime(30_000)
    run.finishItem(['perfect'])

    // Stop in the closing rest: the rest has no notes of its own.
    const result = endPracticeSession({ inFlightSung: false })
    expect(shownLines()).toContain(sessionCompleteLine(100))
    expect(shownLines()).not.toContain(SESSION_STOPPED_LINE)
    await vi.runAllTimersAsync()

    expect(result).toMatchObject({ score: 100, itemsCompleted: 1 })
    expect(mocks.saveSessionRecord).toHaveBeenCalledTimes(1)
    expect(mocks.saveSessionRecord.mock.calls[0]![0]).toMatchObject({
      score: 100,
      notesHit: 1,
      notesTotal: 1,
      durationMs: 30_000,
    })
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('records nothing from a session the transport left, though its last item then ends', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    run.finishItem(['perfect'])
    // The tab is left: the transport resets under the running session.
    markPracticeSessionLeft()
    run.finishItem(['perfect'])
    await vi.advanceTimersByTimeAsync(0)
    expect(shownLines()).toEqual([])
    await vi.runAllTimersAsync()

    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
    expect(getSessionHistory()).toEqual([])
    expect(mocks.creditPracticeTime).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('credits the singing of a skipped item, though nothing after it was sung', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(15_000)
    run.singing(['good'])
    run.sequencer.handleSessionSkip()
    vi.advanceTimersByTime(5_000)

    // Stopped in the next item's count-in: nothing of it was sung.
    expect(endPracticeSession({ inFlightSung: false })).toBeNull()
    expect(shownLines()).toContain(SESSION_SKIPPED_LINE)
    await vi.runAllTimersAsync()

    expect(mocks.creditPracticeTime).toHaveBeenCalledWith(
      20_000,
      expect.anything(),
    )
    expect(mocks.trackEvent).toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('only clears a session whose skipped item was never sung', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    vi.advanceTimersByTime(15_000)
    run.singing(['unsung'])
    run.sequencer.handleSessionSkip()

    expect(endPracticeSession({ inFlightSung: false })).toBeNull()
    expect(shownLines()).toEqual([])
    await vi.runAllTimersAsync()

    expect(mocks.creditPracticeTime).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    run.sequencer.destroy()
  })

  it('shows its summary when a transport Stop ends it in its last rest', async () => {
    const rest: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Breathe',
      restMs: 2000,
    }
    const run = sessionRun(sessionOf([melodyItem('i1', 'First'), rest]))
    run.finishItem(['perfect'])

    run.sequencer.handleTransportStop()
    await vi.advanceTimersByTimeAsync(0)

    expect(run.sequencer.sessionSummary()).toEqual({
      score: 100,
      items: 1,
      name: 'Two warm-ups',
    })
    run.sequencer.destroy()
  })

  it('shows no summary when a transport Stop cuts the session short', async () => {
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), melodyItem('i2', 'Second')]),
    )
    run.finishItem(['perfect'])

    run.sequencer.handleTransportStop()
    await vi.advanceTimersByTimeAsync(0)

    expect(run.sequencer.sessionSummary()).toBeNull()
    expect(shownLines()).toContain(SESSION_STOPPED_LINE)
    run.sequencer.destroy()
  })

  it('scores a session stopped where only a deleted melody is left to come', async () => {
    const rest: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Breathe',
      restMs: 2000,
    }
    const deleted: SessionItem = {
      id: 'i9',
      type: 'melody',
      startBeat: 0,
      label: 'Deleted',
      melodyId: 'melody-gone',
    }
    const run = sessionRun(
      sessionOf([melodyItem('i1', 'First'), rest, deleted]),
    )
    run.finishItem(['perfect'])

    // The sequencer would pass the deleted melody over and end the session
    // whole, so a Stop in the rest before it ends it whole too.
    const result = endPracticeSession({ inFlightSung: false })
    expect(result).toMatchObject({ score: 100, itemsCompleted: 1 })
    expect(shownLines()).toContain(sessionCompleteLine(100))
    expect(shownLines()).not.toContain(SESSION_STOPPED_LINE)
    run.sequencer.destroy()
  })
})
