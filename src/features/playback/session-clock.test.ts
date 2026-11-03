// ============================================================
// A Session-mode session's clock: a pause, and a reset under it
// ============================================================
//
// A session's practice time is its own clock, from Play to its end, and it
// is what a whole session's record and a stopped session's credit both
// carry. Two things the transport does are not practice:
//
//   - A pause. Without the clock stopping, a session paused for ten minutes
//     and then finished was credited the ten minutes.
//   - A reset. Leaving the tab, loading another song or pressing Reset ends
//     a running session without its end, but the session's object stays
//     until the next Stop, and every Stop ends the practice session. A Stop
//     of anything an hour later ended it as a session the singer had just
//     stopped: the notice, and the hour credited as practice.
//
// The playback controller and the stores are the real ones; only the
// network, the grant pass, the beacon and the audio unlock are stand-ins.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaybackController } from '@/features/playback/usePlaybackController'
import { useSessionSequencer } from '@/features/session/useSessionSequencer'
import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { PracticeEngine } from '@/lib/practice-engine'
import { notifications, practiceSession, resetNotifications, setActiveUserSession, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { endPracticeSession, SESSION_SKIPPED_LINE, SESSION_STOPPED_LINE, } from '@/stores/practice-session-store'
import type { NoteResult, PlaybackSession, SessionItem } from '@/types'

const mocks = vi.hoisted(() => ({
  saveSessionRecord: vi.fn(async (_data: Record<string, unknown>) => ({
    id: 'record-1',
  })),
  creditPracticeTime: vi.fn(async (_ms: number | undefined) => {}),
  trackEvent: vi.fn((_event: string) => {}),
}))

vi.mock('@/db/services/session-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  saveSessionRecord: mocks.saveSessionRecord,
  creditPracticeTime: mocks.creditPracticeTime,
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: async () => undefined,
}))
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  trackEvent: mocks.trackEvent,
}))
vi.mock('@/lib/audio-unlock', () => ({
  activateAudioPlayback: async () => {},
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

const SESSION = {
  id: 'session-1',
  name: 'Two warm-ups',
  items: [melodyItem('i1', 'First'), melodyItem('i2', 'Second')],
  author: 'User',
  deletable: true,
  created: 0,
} as PlaybackSession

/** A note the singer sang, as the practice engine grades it. */
const SUNG: NoteResult = {
  item: {
    id: 0,
    note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
    duration: 1,
    startBeat: 0,
  },
  pitchFreq: 293.66,
  pitchCents: 12,
  time: 500,
  rating: 'good',
  avgCents: 12,
  targetNote: 'D4',
}

const runtime = {
  stop: () => {},
  start: () => {},
  pause: () => true,
  resume: () => {},
  setMelody: () => {},
  setDurationBeats: () => {},
  getBPM: () => 120,
  on: () => {},
  seekToBeat: () => {},
}

/** The practice engine without its microphone: what a Stop finalises is
 *  the item it cut short, sung. */
const practiceEngine = {
  startSession: () => {},
  endSession: () => [SUNG],
  resetSession: () => {},
  calculatePracticeResult: (
    ...args: Parameters<PracticeEngine['calculatePracticeResult']>
  ) =>
    PracticeEngine.prototype.calculatePracticeResult.call(
      { calculateScore: PracticeEngine.prototype.calculateScore },
      ...args,
    ),
}

/** The transport as App builds it, over a runtime and engines that only
 *  answer: what is asserted is the clock the stores keep, not the audio. */
function makeController(): ReturnType<typeof usePlaybackController> {
  return usePlaybackController({
    audioEngine: {
      playTone: () => {},
      stopTone: () => {},
      stopAllNotes: () => {},
    } as never,
    playbackRuntime: runtime as never,
    practiceEngine: practiceEngine as never,
    playMode: () => PLAYBACK_MODE_SESSION,
    setPlayMode: (() => {}) as never,
    practiceSubMode: () => 'all',
    setPitchHistory: (() => {}) as never,
    setNoteResults: (() => {}) as never,
    setPracticeResult: (() => {}) as never,
    setLiveScore: (() => {}) as never,
    closeSidebar: () => {},
    filterMelodyForPractice: (m) => m,
    buildSessionPlaybackMelody: (() => ({
      items: [],
      durationBeats: 0,
    })) as never,
    buildScaleMelody: () => {},
    isRecording: () => false,
    finalizeRecording: () => {},
    totalBeats: () => 0,
    endPracticeSession,
    setShouldAutoStartPlayback: (() => {}) as never,
  })
}

/** The sequencer App drives the session with, over the same transport. */
function makeSequencer(transport: ReturnType<typeof makeController>) {
  return useSessionSequencer({
    playbackRuntime: runtime as never,
    practiceEngine: practiceEngine as never,
    noteResults: () => [SUNG],
    setPitchHistory: (() => {}) as never,
    setNoteResults: (() => {}) as never,
    setLiveScore: (() => {}) as never,
    setPlaybackDisplayMelody: () => {},
    setPlaybackDisplayBeats: () => {},
    handleStop: transport.handleStop,
    handlePlay: transport.handlePlay,
    setPlayMode: (() => {}) as never,
    closeSidebar: () => {},
    currentRepeat: () => 1,
    setCurrentRepeat: (() => {}) as never,
    repeatCycles: () => 1,
    buildScaleMelody: () => {},
    setCurrentBeat: (() => {}) as never,
    setCurrentNoteIndex: (() => {}) as never,
  })
}

const shownLines = () => notifications().map((n) => n.message)

/** The practice time a Stop credited, or nothing if it credited none. */
const credited = () => mocks.creditPracticeTime.mock.calls.map((c) => c[0])

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  mocks.saveSessionRecord.mockClear()
  mocks.creditPracticeTime.mockClear()
  mocks.trackEvent.mockClear()
  resetNotifications()
  melodyStore.restoreMelody(MELODY as never)
  setActiveUserSession(SESSION)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("a Session-mode session's clock", () => {
  it('stops while the session is paused', () => {
    const transport = makeController()
    transport.handlePlay()
    vi.advanceTimersByTime(20_000)
    transport.handlePause()
    vi.advanceTimersByTime(10 * 60_000)
    transport.handleResume()
    vi.advanceTimersByTime(10_000)
    void transport.handleStop()

    // Stopped halfway, so practice: thirty seconds sung, not ten minutes.
    expect(shownLines()).toContain(SESSION_STOPPED_LINE)
    expect(credited()).toEqual([30_000])
  })

  it('leaves out the pause a session is stopped in', () => {
    const transport = makeController()
    transport.handlePlay()
    vi.advanceTimersByTime(15_000)
    transport.handlePause()
    vi.advanceTimersByTime(5 * 60_000)
    void transport.handleStop()

    expect(credited()).toEqual([15_000])
  })

  it('ends at a reset, so a later Stop does not end it again', async () => {
    const transport = makeController()
    transport.handlePlay()
    vi.advanceTimersByTime(30_000)

    // The singer leaves the tab, and the transport is reset under the
    // session. Its object stays: this is what the next Stop would find.
    await transport.resetPlaybackState()
    expect(practiceSession()?.id).toBe('session-1')

    // An hour later, a Stop of something else.
    vi.advanceTimersByTime(60 * 60_000)
    void transport.handleStop()

    expect(practiceSession()).toBeNull()
    expect(shownLines()).not.toContain(SESSION_STOPPED_LINE)
    expect(shownLines()).not.toContain(SESSION_SKIPPED_LINE)
    expect(mocks.creditPracticeTime).not.toHaveBeenCalled()
    expect(mocks.trackEvent).not.toHaveBeenCalledWith('session_stopped')
    expect(mocks.saveSessionRecord).not.toHaveBeenCalled()
  })

  it('runs from Play when the session starts from the library', async () => {
    // Play All, a template's start and the tab's Play all start a session
    // through the sequencer, which presses Play. Any reset on the way must
    // not leave that session's clock stopped.
    const transport = makeController()
    const sequencer = makeSequencer(transport)
    sequencer.startSessionPlayback()
    await vi.advanceTimersByTimeAsync(0)
    vi.advanceTimersByTime(20_000)
    void transport.handleStop()

    expect(shownLines()).toContain(SESSION_STOPPED_LINE)
    expect(credited()).toEqual([20_000])
    sequencer.destroy()
  })

  it('runs again when an item is skipped while paused, since the next one plays', async () => {
    const transport = makeController()
    const sequencer = makeSequencer(transport)
    sequencer.startSessionPlayback()
    await vi.advanceTimersByTimeAsync(0)
    vi.advanceTimersByTime(10_000)
    transport.handlePause()
    vi.advanceTimersByTime(60_000)
    // Skip from the pause: the second item starts at once.
    sequencer.handleSessionSkip()
    vi.advanceTimersByTime(10_000)
    void transport.handleStop()

    expect(shownLines()).toContain(SESSION_SKIPPED_LINE)
    expect(credited()).toEqual([20_000])
    sequencer.destroy()
  })
})
