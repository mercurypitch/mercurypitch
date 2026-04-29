// ============================================================
// Walkthrough Store — Track completed walkthroughs
// ============================================================

import { createSignal } from 'solid-js'
import type { WalkthroughContent, WalkthroughProgress, WalkthroughTab, } from '@/types/walkthrough'
import { WALKTHROUGHS } from '@/types/walkthrough'

/** Export WalkthroughTab type for use in components */
export type { WalkthroughTab }

const STORAGE_KEY = 'pitchperfect_walkthroughs'

/** Get all available walkthroughs for a given tab */
export function getWalkthroughsForTab(
  tab: 'practice' | 'editor' | 'settings' | 'study',
) {
  const walkthroughs = WALKTHROUGHS[tab]
  return walkthroughs !== null && walkthroughs !== undefined ? walkthroughs : []
}

/** Get a specific walkthrough by ID */
export function getWalkthrough(id: string): WalkthroughContent | undefined {
  for (const tab of ['practice', 'editor', 'settings', 'study'] as const) {
    const walkthroughs = WALKTHROUGHS[tab]
    const found = walkthroughs.find((w) => w.id === id)
    if (found) return found
  }
  return undefined
}

export const WALKTHROUGH_STEPS: any[] = [] // stub since it was deleted
export function nextWalkthroughStep() {}
export function prevWalkthroughStep() {}
export function endWalkthrough() {}
export function getWalkthroughStep() {
  return 0
}
export function isWalkthroughActive() {
  return false
}
export function startWalkthrough() {}

/** Get progress signal */
export const [walkthroughsProgress, setWalkthroughsProgress] =
  createSignal<WalkthroughProgress>(loadProgress())

/** Get progress for a specific walkthrough */
export function getWalkthroughProgress(id: string): number {
  return walkthroughsProgress()[id] || 0
}

/** Mark a walkthrough as viewed (for tracking) */
export function viewWalkthrough(id: string): void {
  const current = walkthroughsProgress()
  if (!current[id]) {
    current[id] = Date.now()
    setWalkthroughsProgress({ ...current })
    _saveProgress()
  }
}

/** Mark a walkthrough as completed */
export function completeWalkthrough(id: string): void {
  const current = walkthroughsProgress()
  if (!current[id]) {
    current[id] = Date.now()
    setWalkthroughsProgress({ ...current })
    _saveProgress()
  }
}

/** Check if a walkthrough is completed */
export function isWalkthroughCompleted(id: string): boolean {
  return getWalkthroughProgress(id) > 0
}

/** Get remaining walkthroughs (not yet completed) */
export function getRemainingWalkthroughs(): Array<{
  tab: string
  id: string
  title: string
}> {
  const completed = walkthroughsProgress()
  const remaining: Array<{ tab: string; id: string; title: string }> = []

  for (const tab of ['practice', 'editor', 'settings', 'study'] as const) {
    for (const walkthrough of WALKTHROUGHS[tab]) {
      if (!completed[walkthrough.id]) {
        remaining.push({
          tab,
          id: walkthrough.id,
          title: walkthrough.title,
        })
      }
    }
  }

  return remaining
}

/** Get completed walkthroughs */
export function getCompletedWalkthroughs(): Array<{
  tab: string
  id: string
  title: string
}> {
  const completed = walkthroughsProgress()
  const completedList: Array<{ tab: string; id: string; title: string }> = []

  for (const tab of ['practice', 'editor', 'settings', 'study'] as const) {
    for (const walkthrough of WALKTHROUGHS[tab]) {
      if (completed[walkthrough.id]) {
        completedList.push({
          tab,
          id: walkthrough.id,
          title: walkthrough.title,
        })
      }
    }
  }

  return completedList
}

/** Get total count of walkthroughs */
export function getTotalWalkthroughCount(): number {
  let count = 0
  for (const tab of ['practice', 'editor', 'settings', 'study'] as const) {
    count += WALKTHROUGHS[tab].length
  }
  return count
}

/** Get completed count */
export function getCompletedCount(): number {
  const completed = walkthroughsProgress()
  return Object.keys(completed).length
}

/** Get completion percentage */
export function getCompletionPercentage(): number {
  const total = getTotalWalkthroughCount()
  const completed = getCompletedCount()
  return total > 0 ? Math.round((completed / total) * 100) : 0
}

/** Reset all walkthrough progress (for testing) */
export function resetWalkthroughProgress(): void {
  localStorage.removeItem(STORAGE_KEY)
  setWalkthroughsProgress({})
}

/** Load progress from localStorage */
function loadProgress(): WalkthroughProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored)
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed
      }
    }
  } catch {
    // Fail silently
  }
  return {}
}

/** Save progress to localStorage */
function _saveProgress(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(walkthroughsProgress()))
  } catch {
    // Fail silently
  }
}
