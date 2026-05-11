import { createSignal } from 'solid-js'
import { saveSessionRecord } from '@/db/services/session-service'
import { createPersistedSignal } from '@/lib/storage'
import type { PlaybackSession, PracticeResult, SessionItem, SessionResult, } from '@/types'
import { STORAGE_KEY_SESSION_HIST } from './melody-store'

export const [practiceSession, setPracticeSession] =
  createSignal<PlaybackSession | null>(null)
export const [sessionItemIndex, setSessionItemIndex] = createSignal(0)
export const [sessionItemRepeat, setSessionItemRepeat] = createSignal(0)
export const [sessionActive, setSessionActive] = createSignal(false)
export const [sessionModeSignal, setSessionMode] = createSignal(false)

/**
 * Transient flag set by an entry-point (Library "Play All", session
 * template launcher, practice-tab session play button) right before
 * `handlePlay()` is invoked. `handlePlay` reads-and-clears this flag
 * to decide whether the upcoming Play should enter session mode and
 * prime the first session item.
 *
 * Without this gate, `handlePlay()` would inspect `userSession()` and
 * silently promote a single-melody Practice play into a session
 * playback whenever a session happened to be loaded in the editor.
 * (See `assets/plans/session-sequence-advancement.md` Bug 3.)
 */

export const [practiceResults, setPracticeResults] = createSignal<
  PracticeResult[]
>([])
// Results state
export const [sessionResults, setSessionResults] = createPersistedSignal<
  SessionResult[]
>(STORAGE_KEY_SESSION_HIST, [])

export const currentSessionItemIndex = sessionItemIndex
export const currentSessionItemRepeat = sessionItemRepeat
export const sessionMode = sessionModeSignal

export function getSessionHistory() {
  return sessionResults()
}

export function getCurrentSessionItem(): SessionItem | null {
  const session = practiceSession()
  if (!session) return null
  const idx = sessionItemIndex()
  if (idx < 0 || idx >= session.items.length) return null
  return session.items[idx]
}

export function getPracticeSessionItems(): PlaybackSession['items'] {
  const session = practiceSession()
  return session?.items ?? []
}

export function getCurrentSessionItemIndex(): number {
  return sessionItemIndex()
}

export function advanceSessionItem(): SessionItem | null {
  const session = practiceSession()
  if (!session) return null
  const currentItem = getCurrentSessionItem()
  const repeatCount = currentItem?.repeat ?? 1
  const currentRepeat = sessionItemRepeat()

  if (currentRepeat < repeatCount - 1) {
    setSessionItemRepeat(currentRepeat + 1)
    return getCurrentSessionItem()
  } else {
    const next = sessionItemIndex() + 1
    if (next < session.items.length) {
      setSessionItemIndex(next)
      setSessionItemRepeat(0)
      // Return the item AFTER advancing. Must read the index we just
      // set, otherwise the melody/preset path in loadNextSessionItem
      // loads the item at the OLD index when the previous item was a
      // rest (rest handler reads getCurrentSessionItem() before the
      // advance in handleSessionItemComplete).
      const advanced = session.items[next]
      return advanced ?? null
    }
  }
  return null
}

export function recordSessionItemResult(result: PracticeResult): void {
  setPracticeResults((prev) => {
    return [result, ...prev]
  })
}

export function endPracticeSession(): SessionResult | null {
  const session = practiceSession()
  if (!session) return null

  const results = practiceResults()
  const avgScore =
    results.length > 0
      ? Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        )
      : 0

  const result: SessionResult = {
    sessionId: session.id,
    name: session.name,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: results.length,
    practiceItemResult: results,
    totalItems: session.items.length,
    score: avgScore,
  }

  setSessionResults((prev) => [result, ...prev].slice(0, 50))

  void saveSessionRecord({
    melodyName: session.name,
    score: avgScore,
    accuracy: avgScore,
    notesHit: results.length,
    notesTotal: session.items.length,
  })

  setSessionActive(false)
  setPracticeSession(null)
  setSessionItemIndex(0)
  setSessionItemRepeat(0)
  setSessionMode(false)

  return result
}

export function getNoteAccuracyMap(): Map<number, number> {
  const sessionHist = sessionResults()
  const accMap = new Map<number, number[]>()
  for (const entry of sessionHist) {
    for (const pr of entry.practiceItemResult) {
      for (const nr of pr.noteResult) {
        if (!accMap.has(nr.item.note.midi)) accMap.set(nr.item.note.midi, [])
        accMap
          .get(nr.item.note.midi)!
          .push(
            nr.avgCents >= -5
              ? 100
              : Math.max(0, 100 - Math.abs(nr.avgCents) * 5),
          )
      }
    }
  }
  const result = new Map<number, number>()
  for (const [midi, scores] of accMap) {
    result.set(
      midi,
      Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    )
  }
  return result
}
