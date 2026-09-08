// Guitar Night score results share bounded history and exact take identity across rooms.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onMount } from 'solid-js'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { loadGuitarScoreHistory, saveGuitarScoreTake, summarizeGuitarScoreTake, } from '@/lib/guitar/guitar-score-history'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import type { GuitarNightReference } from './reference-port'
import type { useGuitarNightLiveScoreController } from './useGuitarNightLiveScoreController'
import type { useGuitarNightTakeCapture } from './useGuitarNightTakeCapture'

export interface GuitarNightScoreResultsOptions {
  reference: Accessor<GuitarNightReference | null>
  liveScore: Pick<
    ReturnType<typeof useGuitarNightLiveScoreController>,
    'display' | 'boundary' | 'startedAt' | 'inputKind' | 'state'
  >
  scoreTakeCapture: Pick<
    ReturnType<typeof useGuitarNightTakeCapture>,
    'attachCompletedSummary' | 'state' | 'boundaryId' | 'message'
  >
  /** Access is lazy and guarded, including a denied localStorage getter. */
  getStorage?: () => Pick<Storage, 'getItem' | 'setItem'>
}

export function useGuitarNightScoreResults(
  options: GuitarNightScoreResultsOptions,
) {
  const [currentScoreSummary, setCurrentScoreSummary] =
    createSignal<GuitarScoreTakeSummary | null>(null)
  const [currentScoreBoundaryId, setCurrentScoreBoundaryId] = createSignal<
    string | null
  >(null)
  const [scoreHistory, setScoreHistory] = createSignal<
    readonly GuitarScoreTakeSummary[]
  >([])
  const getStorage = options.getStorage ?? (() => globalThis.localStorage)
  let savedScoreRunId: string | null = null

  createEffect(() => {
    const display = options.liveScore.display()
    const boundary = options.liveScore.boundary()
    const startedAt = options.liveScore.startedAt()
    const inputKind = options.liveScore.inputKind()
    if (
      display === null ||
      boundary === null ||
      startedAt === null ||
      inputKind === null
    ) {
      return
    }
    const status =
      display.phase === 'completed'
        ? 'completed'
        : options.liveScore.state() === 'paused'
          ? 'partial'
          : null
    if (status === null) return
    const summary = summarizeGuitarScoreTake(
      display,
      {
        pieceLabel: boundary.reference.title,
        trackLabel: boundary.reference.trackName,
        range: {
          startBeat: boundary.range.start,
          endBeat: boundary.range.end,
        },
        inputKind,
        status,
      },
      startedAt,
    )
    if (summary === null) return
    setCurrentScoreSummary(summary)
    setCurrentScoreBoundaryId(boundary.id)
    if (status === 'completed') {
      options.scoreTakeCapture.attachCompletedSummary(boundary.id, summary)
    }
    if (status !== 'completed' || savedScoreRunId === boundary.id) return
    savedScoreRunId = boundary.id
    try {
      const storage = getStorage()
      if (saveGuitarScoreTake(storage, summary) !== null) {
        setScoreHistory(loadGuitarScoreHistory(storage))
      }
    } catch {
      // The in-memory result remains useful when device storage is unavailable.
    }
  })

  const scoreReplay = createMemo(() => {
    const summary = currentScoreSummary()
    const boundary = options.liveScore.boundary()
    const current = options.reference()
    if (
      summary === null ||
      boundary === null ||
      current === null ||
      currentScoreBoundaryId() !== boundary.id ||
      boundary.reference.songId !== current.songId ||
      boundary.reference.trackId !== current.trackId ||
      summary.range.startBeat !== boundary.range.start ||
      summary.range.endBeat !== boundary.range.end
    ) {
      return null
    }
    return {
      summary,
      inputKind: summary.inputKind,
      referenceId: boundary.reference.songId,
      trackId: boundary.reference.trackId,
      range: {
        start: boundary.range.start,
        end: boundary.range.end,
      } satisfies LoopSpan,
    }
  })
  const scoreTakeKeep = createMemo(() => {
    const replay = scoreReplay()
    const state = options.scoreTakeCapture.state()
    if (
      replay === null ||
      replay.summary.status !== 'completed' ||
      options.scoreTakeCapture.boundaryId() !== currentScoreBoundaryId() ||
      state === 'idle'
    ) {
      return null
    }
    return { state, message: options.scoreTakeCapture.message() }
  })

  onMount(() => {
    try {
      setScoreHistory(loadGuitarScoreHistory(getStorage()))
    } catch {
      setScoreHistory([])
    }
  })

  return {
    currentScoreSummary,
    currentScoreBoundaryId,
    scoreHistory,
    scoreReplay,
    scoreTakeKeep,
  }
}
