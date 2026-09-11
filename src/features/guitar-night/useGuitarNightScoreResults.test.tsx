// Score-result tests preserve admitted-run identity and privacy-bounded history.
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { batch, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarLiveScoreDisplay } from '@/lib/guitar/guitar-live-score'
import { loadGuitarScoreHistory, saveGuitarScoreTake, summarizeGuitarScoreTake, } from '@/lib/guitar/guitar-score-history'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { PerformanceTakeKeepState } from '@/lib/use-performance-take-keep'
import type { GuitarNightReference } from './reference-port'
import type { GuitarNightLiveScoreState } from './useGuitarNightLiveScoreController'
import type { GuitarNightScoreResultsOptions } from './useGuitarNightScoreResults'
import { useGuitarNightScoreResults } from './useGuitarNightScoreResults'
import type { GuitarNightScoreLiveBoundary } from './useGuitarNightScoreRoomController'

const REFERENCE: GuitarNightReference = {
  kind: 'authored',
  songId: 'accepted-revision-1',
  title: 'Recorded melody',
  trackId: 'lead',
  trackName: 'Lead guitar',
  tempoBpm: 60,
  tuning: DEFAULT_GUITAR_TUNING,
  outOfRangeNotes: 0,
  tracks: [{ id: 'lead', name: 'Lead guitar', noteCount: 4 }],
  notes: [],
}
const BOUNDARY: GuitarNightScoreLiveBoundary = {
  id: 'score-run-1',
  reference: REFERENCE,
  range: { start: 0, end: 4 },
  tempoBpm: 60,
  scoreTempoBpm: 60,
  countInBeats: 0,
  sampleRate: 48_000,
  startedAtSeconds: 10,
  completedAtSeconds: 14,
  beatToSeconds: (beat) => beat,
}
const DISPLAY: GuitarLiveScoreDisplay = {
  phase: 'completed',
  basis: 'cumulative',
  score: 90,
  grade: 'A',
  rollingScore: 90,
  rollingGrade: 'A',
  cumulativeScore: 90,
  cumulativeGrade: 'A',
  currentStreak: 4,
  bestStreak: 4,
  targetCount: 4,
  totals: {
    judgedTargets: 4,
    hitTargets: 4,
    missedTargets: 0,
    skippedTargets: 0,
    points: 360,
    possiblePoints: 400,
  },
  evidenceStatus: 'complete',
  detectedGapCount: 0,
  recentJudgments: [],
}
const STARTED_AT = 1_725_000_000_000

function createHarness(
  getStorage?: GuitarNightScoreResultsOptions['getStorage'],
) {
  const [reference, setReference] = createSignal<GuitarNightReference | null>(
    REFERENCE,
  )
  const [display, setDisplay] = createSignal<GuitarLiveScoreDisplay | null>(
    null,
  )
  const [boundary, setBoundary] =
    createSignal<GuitarNightScoreLiveBoundary | null>(null)
  const [startedAt, setStartedAt] = createSignal<number | null>(null)
  const [inputKind, setInputKind] = createSignal<GuitarInputProfileKind | null>(
    null,
  )
  const [state, setState] = createSignal<GuitarNightLiveScoreState>('ready')
  const [captureState, setCaptureState] =
    createSignal<PerformanceTakeKeepState>('idle')
  const [captureBoundaryId, setCaptureBoundaryId] = createSignal<string | null>(
    null,
  )
  const attachCompletedSummary = vi.fn(() => true)
  const results = useGuitarNightScoreResults({
    reference,
    liveScore: { display, boundary, startedAt, inputKind, state },
    scoreTakeCapture: {
      attachCompletedSummary,
      state: captureState,
      boundaryId: captureBoundaryId,
      message: () => 'Ready to keep',
    },
    ...(getStorage === undefined ? {} : { getStorage }),
  })
  const publish = (
    nextDisplay = DISPLAY,
    nextState: GuitarNightLiveScoreState = 'complete',
  ) => {
    batch(() => {
      setBoundary(BOUNDARY)
      setStartedAt(STARTED_AT)
      setInputKind('interface')
      setState(nextState)
      setDisplay(nextDisplay)
      setCaptureBoundaryId(BOUNDARY.id)
      setCaptureState('ready')
    })
  }
  return {
    results,
    publish,
    setReference,
    setDisplay,
    setBoundary,
    setStartedAt,
    setInputKind,
    setState,
    setCaptureState,
    setCaptureBoundaryId,
    attachCompletedSummary,
  }
}

function renderResults(
  getStorage?: GuitarNightScoreResultsOptions['getStorage'],
) {
  let harness!: ReturnType<typeof createHarness>
  render(() => {
    harness = createHarness(getStorage)
    return null
  })
  return harness
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useGuitarNightScoreResults', () => {
  it('never turns a prepared replay or history into an admitted score', () => {
    const summary = summarizeGuitarScoreTake(
      DISPLAY,
      {
        pieceLabel: REFERENCE.title,
        trackLabel: REFERENCE.trackName,
        range: { startBeat: 0, endBeat: 4 },
        inputKind: 'interface',
        status: 'completed',
      },
      STARTED_AT,
    )
    expect(summary).not.toBeNull()
    saveGuitarScoreTake(localStorage, summary!)
    const harness = renderResults()
    harness.setCaptureBoundaryId(BOUNDARY.id)
    harness.setCaptureState('ready')

    expect(harness.results.scoreHistory()).toEqual([summary])
    expect(harness.results.currentScoreSummary()).toBeNull()
    expect(harness.results.currentScoreBoundaryId()).toBeNull()
    expect(harness.results.scoreReplay()).toBeNull()
    expect(harness.results.scoreTakeKeep()).toBeNull()
    expect(harness.attachCompletedSummary).not.toHaveBeenCalled()
  })

  it('presents a held score without persisting it or offering Keep', () => {
    const harness = renderResults()
    harness.publish(
      { ...DISPLAY, phase: 'active', basis: 'rolling-16' },
      'active',
    )
    expect(harness.results.currentScoreSummary()).toBeNull()

    harness.setState('paused')

    expect(harness.results.currentScoreSummary()?.status).toBe('partial')
    expect(harness.results.scoreReplay()?.range).toEqual({ start: 0, end: 4 })
    expect(harness.results.scoreTakeKeep()).toBeNull()
    expect(harness.results.scoreHistory()).toEqual([])
    expect(loadGuitarScoreHistory(localStorage)).toEqual([])
    expect(harness.attachCompletedSummary).not.toHaveBeenCalled()
  })

  it('attaches and persists a completed summary only once per admitted boundary', () => {
    const setItem = vi.fn((key: string, value: string) =>
      localStorage.setItem(key, value),
    )
    const harness = renderResults(() => ({
      getItem: (key) => localStorage.getItem(key),
      setItem,
    }))
    harness.publish()

    const summary = harness.results.currentScoreSummary()
    expect(summary).toMatchObject({
      status: 'completed',
      savedAt: STARTED_AT,
      pieceLabel: REFERENCE.title,
      inputKind: 'interface',
      score: 90,
      grade: 'A',
    })
    expect(harness.results.currentScoreBoundaryId()).toBe(BOUNDARY.id)
    expect(harness.attachCompletedSummary).toHaveBeenCalledWith(
      BOUNDARY.id,
      summary,
    )
    expect(harness.results.scoreHistory()).toEqual([summary])
    expect(harness.results.scoreTakeKeep()).toEqual({
      state: 'ready',
      message: 'Ready to keep',
    })
    expect(setItem).toHaveBeenCalledOnce()

    harness.setDisplay({ ...DISPLAY })
    harness.results.scoreReplay()
    harness.results.scoreReplay()
    expect(setItem).toHaveBeenCalledOnce()
    expect(harness.results.scoreHistory()).toHaveLength(1)
  })

  it.each(['boundary', 'startedAt', 'inputKind'] as const)(
    'requires the admitted %s before creating a summary',
    (missing) => {
      const harness = renderResults()
      batch(() => {
        harness.publish()
        if (missing === 'boundary') harness.setBoundary(null)
        if (missing === 'startedAt') harness.setStartedAt(null)
        if (missing === 'inputKind') harness.setInputKind(null)
      })

      expect(harness.results.currentScoreSummary()).toBeNull()
      expect(harness.results.scoreHistory()).toEqual([])
      expect(harness.attachCompletedSummary).not.toHaveBeenCalled()
    },
  )

  it('hides replay and Keep for another accepted reference or part', () => {
    const harness = renderResults()
    harness.publish()

    for (const reference of [
      null,
      { ...REFERENCE, songId: 'accepted-revision-2' },
      { ...REFERENCE, trackId: 'another-part' },
    ]) {
      harness.setReference(reference)
      expect(harness.results.scoreReplay()).toBeNull()
      expect(harness.results.scoreTakeKeep()).toBeNull()
    }
    harness.setReference(REFERENCE)
    expect(harness.results.scoreReplay()?.referenceId).toBe(REFERENCE.songId)
    expect(harness.results.scoreTakeKeep()?.state).toBe('ready')
  })

  it('requires the exact summary boundary and range for result actions', () => {
    const harness = renderResults()
    harness.publish()
    harness.setDisplay(null)

    for (const boundary of [
      { ...BOUNDARY, id: 'score-run-2' },
      { ...BOUNDARY, range: { start: 1, end: 4 } },
      { ...BOUNDARY, range: { start: 0, end: 3 } },
    ]) {
      harness.setBoundary(boundary)
      expect(harness.results.scoreReplay()).toBeNull()
      expect(harness.results.scoreTakeKeep()).toBeNull()
    }
    harness.setBoundary(BOUNDARY)
    harness.setCaptureBoundaryId('score-run-2')
    expect(harness.results.scoreReplay()).not.toBeNull()
    expect(harness.results.scoreTakeKeep()).toBeNull()
    harness.setCaptureBoundaryId(BOUNDARY.id)
    harness.setCaptureState('idle')
    expect(harness.results.scoreTakeKeep()).toBeNull()
  })

  it('keeps an in-memory result when storage access is denied', () => {
    const getStorage = vi.fn(() => {
      throw new Error('Storage denied')
    })
    const harness = renderResults(getStorage)
    expect(harness.results.scoreHistory()).toEqual([])

    harness.publish()

    expect(getStorage).toHaveBeenCalledTimes(2)
    expect(harness.results.currentScoreSummary()?.status).toBe('completed')
    expect(harness.results.scoreReplay()).not.toBeNull()
    expect(harness.results.scoreTakeKeep()?.state).toBe('ready')
    expect(harness.results.scoreHistory()).toEqual([])
  })
})
