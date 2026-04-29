import { createSignal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { PlaybackSession, PracticeResult, SessionItem, SessionResult, } from '@/types'
import { STORAGE_KEY_SESSION_HIST } from './melody-store'

export const [practiceSession, setPracticeSession] =
  createSignal<PlaybackSession | null>(null)
export const [sessionItemIndex, setSessionItemIndex] = createSignal(0)
export const [sessionItemRepeat, setSessionItemRepeat] = createSignal(0)
export const [sessionActive, setSessionActive] = createSignal(false)
export const [sessionModeSignal, setSessionMode] = createSignal(false)

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

export function initSessionHistory(): void {
  // FIXME: See to remove this from APIs if not required for testing integration!
  //
  // handled by persisted signal initialization
}

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
      return getCurrentSessionItem()
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

  const scores = sessionResults()
  // calculate total score from recent results linked to this session
  // for simplicity, grabbing the latest result just added
  // TODO: see do we want to calculate total score on all melody items (SessionItem items) or just
  // recent one?
  const recentScore = scores.length > 0 ? scores[0].score : 0

  const result: SessionResult = {
    sessionId: session.id,
    name: session.name,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: scores.length, // TODO: calculate skipped ones; approximation
    practiceItemResult: practiceResults(),
    totalItems: session.items.length,
    score: recentScore,
  }

  setSessionResults((prev) => [result, ...prev].slice(0, 50))

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
