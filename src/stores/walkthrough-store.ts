// ============================================================
// Walkthrough Store — Track completed walkthroughs
// ============================================================

import { createSignal } from 'solid-js'
import { TAB_COMPOSE, TAB_SETTINGS, TAB_SINGING, WALKTHROUGH_TAB_STUDY, } from '@/features/tabs/constants'
import type { WalkthroughProgress, WalkthroughTab } from '@/types/walkthrough'
import { WALKTHROUGHS } from '@/types/walkthrough'

/** All walkthrough tab keys as a const array for iteration */
const WALKTHROUGH_TABS = [
  TAB_SINGING,
  TAB_COMPOSE,
  TAB_SETTINGS,
  WALKTHROUGH_TAB_STUDY,
] as const

/** Export WalkthroughTab type for use in components */
export type { WalkthroughTab }

const STORAGE_KEY = 'pitchperfect_walkthroughs'

/** Get all available walkthroughs for a given tab */
export function getWalkthroughsForTab(tab: WalkthroughTab) {
  const walkthroughs = WALKTHROUGHS[tab]
  return walkthroughs !== null && walkthroughs !== undefined ? walkthroughs : []
}

/** Get a specific walkthrough by ID */
export function getWalkthrough(id: string) {
  for (const tab of WALKTHROUGH_TABS) {
    const walkthroughs = WALKTHROUGHS[tab] ?? []
    const found = walkthroughs.find((w: { id: string }) => w.id === id)
    if (found) return found
  }
  return undefined
}

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
  if (!(id in current)) {
    current[id] = 0
    setWalkthroughsProgress({ ...current })
    _saveProgress()
  }
}

/** Mark a walkthrough as completed */
export function completeWalkthrough(id: string): void {
  const current = walkthroughsProgress()
  current[id] = Date.now()
  setWalkthroughsProgress({ ...current })
  _saveProgress()
}

/** Check if a walkthrough is completed */
export function isWalkthroughCompleted(id: string): boolean {
  return getWalkthroughProgress(id) > 0
}

/** Get remaining walkthroughs (not yet completed — value > 0 means completed) */
export function getRemainingWalkthroughs(): Array<{
  tab: string
  id: string
  title: string
}> {
  const progress = walkthroughsProgress()
  const remaining: Array<{ tab: string; id: string; title: string }> = []

  for (const tab of WALKTHROUGH_TABS) {
    for (const walkthrough of WALKTHROUGHS[tab] ?? []) {
      const val = progress[walkthrough.id]
      if (val === undefined || val === 0 || val < 0) {
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

/** Get completed walkthroughs (value > 0 means completed, not just viewed) */
export function getCompletedWalkthroughs(): Array<{
  tab: string
  id: string
  title: string
}> {
  const progress = walkthroughsProgress()
  const completedList: Array<{ tab: string; id: string; title: string }> = []

  for (const tab of WALKTHROUGH_TABS) {
    for (const walkthrough of WALKTHROUGHS[tab] ?? []) {
      if (progress[walkthrough.id] > 0) {
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
  for (const tab of WALKTHROUGH_TABS) {
    count += (WALKTHROUGHS[tab] ?? []).length
  }
  return count
}

/** Get completed count (only walkthroughs with value > 0, not just viewed) */
export function getCompletedCount(): number {
  const progress = walkthroughsProgress()
  return Object.values(progress).filter((v) => v > 0).length
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
