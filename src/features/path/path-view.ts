import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { createPersistedSignal } from '@/lib/storage'

export type PathView = 'ascent' | 'path'

export const PATH_VIEW_STORAGE_KEY = 'mp_path_view'
export const DEFAULT_PATH_VIEW: PathView = 'ascent'

function isPathView(value: unknown): value is PathView {
  return value === 'ascent' || value === 'path'
}

const [view, setView] = createPersistedSignal<PathView>(
  PATH_VIEW_STORAGE_KEY,
  DEFAULT_PATH_VIEW,
  { validator: isPathView },
)

export const pathView = view
export const setPathView = setView

export type PathDayState = 'complete' | 'current' | 'available' | 'locked'

export interface PathDayNode {
  /** 1-based display position inside the week. */
  day: number
  state: PathDayState
  actionable: boolean
}

/**
 * Derive the seven visible day wells from the existing week-level progress.
 * Nodes do not invent separate lesson state: completed dates light from the
 * left, the next day opens the shared week guide, and all later days remain
 * locked until progress reaches them.
 */
export function buildPathDayNodes(
  state: WeekState,
  fill: number,
): PathDayNode[] {
  const safeFill = Math.max(0, Math.min(DAYS_PER_WEEK, fill))

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    let dayState: PathDayState = 'locked'

    if (state === 'complete' || index < safeFill) {
      dayState = 'complete'
    } else if (state === 'active' && index === safeFill) {
      dayState = 'current'
    } else if (state === 'available' && index === 0) {
      dayState = 'available'
    }

    return {
      day: index + 1,
      state: dayState,
      actionable: dayState !== 'locked',
    }
  })
}
