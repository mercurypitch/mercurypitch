// ============================================================
// Jam line score tracker — separates playback completion from navigation.
// ============================================================
//
// A lyric click, scrub, Stop rewind, or remote seek changes the active line
// but completes nothing. Only a naturally advancing, actively playing clock
// may close a line and produce a score.

import { lineRange } from '@/lib/jam/jam-line-scoring'
import { lineIndexAt } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'

export interface OpenJamScoreLine {
  index: number
  atMs: number
  positionSec: number
}

export interface JamLineScoreTrackerState {
  songId: string | null
  openLine: OpenJamScoreLine | null
  navigationToken: number
  pendingNavigationTarget: number | null
}

export interface JamLineScoreTrackerInput {
  songId: string | null
  lines: readonly LyricsLineTiming[]
  positionSec: number
  nowMs: number
  isPlaying: boolean
  isPaused: boolean
  navigation: { token: number; toSec: number }
}

export interface JamLineScoreTrackerStep {
  state: JamLineScoreTrackerState
  completedLine: OpenJamScoreLine | null
}

const NAVIGATION_SNAP_SEC = 0.2
const NATURAL_TICK_SLACK_SEC = 1.5

export const EMPTY_JAM_LINE_SCORE_TRACKER: JamLineScoreTrackerState = {
  songId: null,
  openLine: null,
  navigationToken: 0,
  pendingNavigationTarget: null,
}

function atTarget(positionSec: number, targetSec: number): boolean {
  return Math.abs(positionSec - targetSec) <= NAVIGATION_SNAP_SEC
}

function openAt(input: JamLineScoreTrackerInput): OpenJamScoreLine | null {
  const index = lineIndexAt(input.lines, input.positionSec)
  return index < 0
    ? null
    : { index, atMs: input.nowMs, positionSec: input.positionSec }
}

/** Advance the tracker by one reactive playhead update. */
export function advanceJamLineScoreTracker(
  previous: JamLineScoreTrackerState,
  input: JamLineScoreTrackerInput,
): JamLineScoreTrackerStep {
  if (input.songId === null) {
    return {
      state: {
        ...EMPTY_JAM_LINE_SCORE_TRACKER,
        navigationToken: input.navigation.token,
      },
      completedLine: null,
    }
  }

  if (previous.songId !== input.songId) {
    return {
      state: {
        songId: input.songId,
        openLine: openAt(input),
        navigationToken: input.navigation.token,
        pendingNavigationTarget: null,
      },
      completedLine: null,
    }
  }

  if (previous.navigationToken !== input.navigation.token) {
    const arrived = atTarget(input.positionSec, input.navigation.toSec)
    return {
      state: {
        songId: input.songId,
        openLine: arrived ? openAt(input) : null,
        navigationToken: input.navigation.token,
        pendingNavigationTarget: arrived ? null : input.navigation.toSec,
      },
      completedLine: null,
    }
  }

  if (previous.pendingNavigationTarget !== null) {
    if (!atTarget(input.positionSec, previous.pendingNavigationTarget)) {
      return { state: previous, completedLine: null }
    }
    return {
      state: {
        ...previous,
        openLine: openAt(input),
        pendingNavigationTarget: null,
      },
      completedLine: null,
    }
  }

  const nextOpen = openAt(input)
  const open = previous.openLine
  if (open?.index === nextOpen?.index) {
    return { state: previous, completedLine: null }
  }

  const nextState: JamLineScoreTrackerState = {
    ...previous,
    openLine: nextOpen,
  }
  if (open === null || !input.isPlaying || input.isPaused) {
    return { state: nextState, completedLine: null }
  }

  const { endSec } = lineRange(input.lines, open.index)
  const naturallyCompleted =
    input.positionSec >= endSec &&
    input.positionSec <= endSec + NATURAL_TICK_SLACK_SEC

  return {
    state: nextState,
    completedLine: naturallyCompleted ? open : null,
  }
}
