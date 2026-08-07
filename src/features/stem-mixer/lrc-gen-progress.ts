// ============================================================
// LRC gen progress — the autosave a half-finished mapping resumes from
// ============================================================
//
// Mapping a song by hand takes long enough that a reload mid-session is not a
// hypothetical, so the mapper writes its cursor and its timings to
// localStorage as it goes. Two things make this worth its own module rather
// than a block inside the controller:
//
//   - the write is debounced, because a fast word pass fires it several times
//     a second and localStorage is synchronous;
//   - the read has to distrust everything it finds. A blob can predate the
//     pass split, or belong to lyrics the singer has since replaced, and
//     restoring either onto the current song silently corrupts the mapping.
//
// Both halves are pure over their inputs — `parseSavedGenProgress` takes the
// raw string rather than reaching for storage itself — so the distrust is
// testable without a browser.
//
// Tests: src/tests/lrc-gen-progress.test.ts
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 0).

import { restoreLineTimes, restoreTouchedLines, restoreWordSweepTimingsMap, restoreWordTimingsMap, } from './lrc-gen-engine'
import type { LrcGenPass } from './lrc-gen-passes'
import { normalizePass } from './lrc-gen-passes'
import type { LrcGenInputMode, WordSweepTimingsMap, WordTimingsMap, } from './types'

/** How long a burst of edits coalesces before it reaches storage. */
const SAVE_DEBOUNCE_MS = 1500

/** What gets written. Field names are part of the on-disk format. */
export interface LrcGenProgressPayload {
  lineTimes: (number | undefined)[]
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
  lineIdx: number
  wordIdx: number
  inputMode: LrcGenInputMode
  /** Absent in sessions saved before the pass split — see `normalizePass`. */
  pass?: LrcGenPass
  touchedLines: number[]
  lyricsIdentity: string
  timestamp: number
}

/** What an interrupted session left behind, once validated. */
export interface SavedGenProgress {
  lineTimes: (number | undefined)[]
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
  touchedLines: Set<number>
  lineIdx: number
  wordIdx: number
  pass: LrcGenPass
  /** null when the blob predates the setting or holds something unknown. */
  inputMode: LrcGenInputMode | null
}

/** Per-session, so two songs open in two tabs cannot overwrite each other. */
export function genProgressKey(sessionId: string): string {
  return `lyrics_gen_v1_${sessionId}`
}

/**
 * Validate a stored blob against the song it is about to be restored onto.
 *
 * Returns null for anything it cannot vouch for, which the caller reads as
 * "start fresh" — the only safe reading, since a half-understood blob would
 * put times on the wrong lines.
 */
export function parseSavedGenProgress(params: {
  raw: string | null
  lines: string[]
  /** Identity of the lyrics currently loaded, from the same hash the writer used. */
  identity: string
}): SavedGenProgress | null {
  const { raw, lines, identity } = params
  if (raw === null) return null
  try {
    const data: Record<string, unknown> = JSON.parse(raw)
    // An absent identity means the blob predates the field; those are old
    // enough to trust, since nothing else wrote this key.
    const belongsToCurrentLyrics =
      data.lyricsIdentity === undefined || data.lyricsIdentity === identity
    if (
      !belongsToCurrentLyrics ||
      !Array.isArray(data.lineTimes) ||
      data.lineTimes.length === 0
    ) {
      return null
    }
    const lineIdx =
      typeof data.lineIdx === 'number' && Number.isInteger(data.lineIdx)
        ? Math.max(0, Math.min(data.lineIdx, lines.length))
        : 0
    const wordIdx =
      typeof data.wordIdx === 'number' &&
      Number.isInteger(data.wordIdx) &&
      data.wordIdx >= 0
        ? data.wordIdx
        : 0
    return {
      lineTimes: restoreLineTimes(data.lineTimes, lines.length),
      wordTimings: restoreWordTimingsMap(data.wordTimings, lines.length),
      wordEndTimings: restoreWordTimingsMap(data.wordEndTimings, lines.length),
      wordSweepTimings: restoreWordSweepTimingsMap(
        data.wordSweepTimings,
        lines.length,
      ),
      touchedLines: restoreTouchedLines({
        savedTouchedLines: data.touchedLines,
        lines,
        lineIdx,
        wordIdx,
      }),
      lineIdx,
      wordIdx,
      pass: normalizePass(data.pass),
      inputMode:
        data.inputMode === 'marker' || data.inputMode === 'tap'
          ? data.inputMode
          : null,
    }
  } catch {
    return null
  }
}

export interface GenProgressStore {
  /** Queue a write. Cheap enough to call on every keystroke. */
  save: (payload: LrcGenProgressPayload) => void
  /** Write anything queued right now. */
  flush: () => void
  /** Drop the queue and the stored blob. */
  clear: () => void
  /** The raw stored string, for `parseSavedGenProgress`. */
  read: () => string | null
}

/**
 * The debounced writer. `key` is a callback because the session id can change
 * under a controller that outlives one song.
 */
export function createGenProgressStore(key: () => string): GenProgressStore {
  let pending: LrcGenProgressPayload | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    const payload = pending
    pending = null
    timer = undefined
    if (payload === null) return
    try {
      localStorage.setItem(key(), JSON.stringify(payload))
    } catch {
      /* storage full */
    }
  }

  return {
    flush,
    save: (payload) => {
      pending = payload
      if (timer !== undefined) return
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    clear: () => {
      pending = null
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      try {
        localStorage.removeItem(key())
      } catch {
        /* ignore */
      }
    },
    read: () => {
      try {
        return localStorage.getItem(key())
      } catch {
        return null
      }
    },
  }
}
