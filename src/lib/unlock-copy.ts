// ============================================================
// Unlock copy: what the native app says when a badge or goal is earned
// ============================================================
//
// One place for the words, because three surfaces say them: the chip under a
// room's result (room-kit/UnlockChip.tsx), the pill, the native shell's and
// a room's on the web (src/components/notice-pill/NoticePill.tsx) and, on
// the web, a drill's stage (src/features/exercises/stage/stage-notice.ts). The web's toasts
// keep their own wording, "Badge unlocked: X", which the grant engine still
// writes.
//
// A single unlock names itself. Two or more say how many, and the names go
// on a second line (the pill, the stage) or in a list behind a tap (the
// chip), because three names in one sentence do not fit a phone's header.

/** One badge or achievement, as it was granted. */
export interface UnlockItem {
  readonly kind: 'badge' | 'achievement'
  readonly name: string
  /** The seed's icon key, which names its medallion (badge-art.ts). */
  readonly icon?: string
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The line an unlock, or a set of them earned together, is announced with.
 *
 *   one badge                 New badge: Steady Hold
 *   one achievement           New achievement: First Week
 *   two badges                2 new badges
 *   three achievements        3 new achievements
 *   a badge and two goals     1 new badge and 2 achievements
 */
export function unlockSummary(items: readonly UnlockItem[]): string {
  const badges = items.filter((item) => item.kind === 'badge').length
  const goals = items.length - badges
  if (items.length === 1) {
    const only = items[0]!
    return only.kind === 'badge'
      ? `New badge: ${only.name}`
      : `New achievement: ${only.name}`
  }
  if (goals === 0) return `${badges} new badges`
  if (badges === 0) return `${goals} new achievements`
  return `${count(badges, 'new badge', 'new badges')} and ${count(
    goals,
    'achievement',
    'achievements',
  )}`
}

/**
 * The first line of a notice whose second line is the names
 * (`unlockNames`), as a drill's stage draws one: what was earned, and how
 * many.
 *
 *   one badge                 New badge
 *   one achievement           New achievement
 *   two or more               as `unlockSummary`: 2 new achievements
 */
export function unlockHeading(items: readonly UnlockItem[]): string {
  if (items.length !== 1) return unlockSummary(items)
  return items[0]!.kind === 'badge' ? 'New badge' : 'New achievement'
}

/** The names of a set, in the order they were earned, for a second line. */
export function unlockNames(items: readonly UnlockItem[]): string {
  return items.map((item) => item.name).join(', ')
}
