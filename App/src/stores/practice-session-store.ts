import { createPersistedSignal } from '@/lib/storage'
import { createSignal } from 'solid-js'
import type { PracticeSession, SessionResult, SessionItem } from '@/types'

// Practice State signals
export const [practiceSession, setPracticeSession] = createSignal<PracticeSession | null>(null)
export const [sessionItemIndex, setSessionItemIndex] = createSignal(0)
export const [sessionItemRepeat, setSessionItemRepeat] = createSignal(0)
export const [sessionActive, setSessionActive] = createSignal(false)
export const [sessionModeSignal, setSessionMode] = createSignal(false)

// Results state
export const [sessionResults, setSessionResults] = createPersistedSignal<SessionResult[]>(
  'pitchperfect_session_results',
  [],
)

export const currentSessionItemIndex = sessionItemIndex
export const currentSessionItemRepeat = sessionItemRepeat
export const sessionMode = sessionModeSignal

export function initSessionHistory(): void {
  // handled by persisted signal initialization
}

export function getCurrentSessionItem(): SessionItem | null {
  const session = practiceSession()
  if (!session) return null
  const idx = sessionItemIndex()
  if (idx < 0 || idx >= session.items.length) return null
  return session.items[idx]
}

export function getSessionItems(): PracticeSession['items'] {
  const session = practiceSession()
  return session?.items ?? []
}

export function getCurrentSessionItemIndex(): number {
  return sessionItemIndex()
}

export function advanceSessionItem(): void {
  const session = practiceSession()
  if (!session) return
  const currentItem = getCurrentSessionItem()
  const repeatCount = currentItem?.repeat ?? 1
  const currentRepeat = sessionItemRepeat()
  
  if (currentRepeat < repeatCount - 1) {
    setSessionItemRepeat(currentRepeat + 1)
  } else {
    const next = sessionItemIndex() + 1
    if (next < session.items.length) {
      setSessionItemIndex(next)
      setSessionItemRepeat(0)
    }
  }
}

export function recordSessionItemResult(score: number): void {
  const session = practiceSession()
  if (!session) return
  
  setSessionResults((prev) => {
    const newResult: SessionResult = {
      sessionId: session.id,
      name: session.name,
      sessionName: session.name,
      completedAt: Date.now(),
      itemsCompleted: sessionItemIndex(),
      totalItems: session.items.length,
      score,
    }
    return [newResult, ...prev].slice(0, 50)
  })
}

export function endPracticeSession(): SessionResult | null {
  const session = practiceSession()
  if (!session) return null

  const scores = sessionResults()
  // calculate total score from recent results linked to this session
  // for simplicity, grabbing the latest result just added
  const recentScore = scores.length > 0 ? scores[0].score : 0

  const result: SessionResult = {
    sessionId: session.id,
    name: session.name,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: scores.length, // approximation
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
