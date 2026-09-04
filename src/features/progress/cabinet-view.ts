// ============================================================
// Cabinet view — every badge and achievement, ready to display
// ============================================================
// The Milestones shelf shows what has been earned. The cabinet is the whole
// catalogue with where the singer stands on each mark, so the next one is
// always in view. Labels, grouping and art are decided here; the component
// only renders them.
//
// This is where the achievement shelves and the percentage arithmetic came
// when the grids left the Challenges tab.

import type { AchievementCategory } from '@/db/entities'
import { badgeArtSrc } from '@/features/challenges/badge-art'
import type { ProgressAchievementStanding, ProgressBadgeStanding, ProgressModel, ProgressRecognitionSummary, } from './model'
import type { ProgressAchievementRowView, ProgressAchievementShelfView, ProgressBadgeTileView, ProgressCabinetView, } from './ProgressPage'

/**
 * The three shelves, in order, each with its own goals.
 *
 * Fifty-nine goals in one flat grid is a wall — a singer on day one and a
 * singer on month six were reading the same undifferentiated list. Cut into
 * "first week", "keep going" and "long haul", there is always a near one in
 * view and the far ones stay visible as something to aim at.
 *
 * The names and blurbs live here rather than in the seed because they
 * describe the SHELF, not any one goal — a new achievement joins a band
 * without needing to restate what the band is for.
 */
export const ACHIEVEMENT_SHELVES: ReadonlyArray<{
  id: AchievementCategory
  title: string
  blurb: string
}> = [
  {
    id: 'beginnings',
    title: 'Beginnings',
    blurb: 'First times. Most of these fall in your first week.',
  },
  {
    id: 'building',
    title: 'Building',
    blurb: 'The weekly rhythm — one of these should land most weeks.',
  },
  {
    id: 'mastery',
    title: 'Mastery',
    blurb: 'The long haul. Months, not weeks.',
  },
]

/**
 * The raw count behind a percentage, for the "3 / 10" label.
 *
 * userAchievements.progress is stored as 0-100 (the grant engine writes a
 * percentage), but the label and the bar once both read it as a count:
 * "Thousand Notes" at half way showed "50 / 1000" on a 5%-wide bar, and a
 * finished "50 Sessions" showed "100 / 50" on a bar twice its track. The
 * bar takes the percentage directly and the label converts back. Lossy by
 * one percent of the target, which is invisible at these sizes.
 */
export function achievementCount(progress: number, required: number): number {
  if (!Number.isFinite(required) || required <= 0) return 0
  const pct = Math.max(0, Math.min(100, progress))
  return Math.min(required, Math.round((pct / 100) * required))
}

/** 0-100, whole: a stale row can hold more than 100 after a target is lowered. */
export function achievementPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, Math.round(progress)))
}

/** Formats an ISO instant for display, or null when it cannot be read. */
export type DateLabel = (value: string | null) => string | null

function badgeTile(
  standing: ProgressBadgeStanding,
  formatDate: DateLabel,
): ProgressBadgeTileView {
  const tile: ProgressBadgeTileView = {
    id: standing.id,
    title: standing.name,
    tier: standing.tier,
    earned: standing.earned,
    // The seed's unlock condition is the instruction; the description is
    // the fallback for a seed that never wrote one.
    howToEarn:
      standing.unlockCondition.trim() === ''
        ? standing.description
        : standing.unlockCondition,
    icon: standing.icon,
  }
  const artUrl = badgeArtSrc(standing.icon)
  if (artUrl !== undefined) tile.artUrl = artUrl
  if (standing.earned) {
    const on = formatDate(standing.earnedAt)
    tile.earnedAtLabel = on === null ? 'Earned' : `Earned ${on}`
  }
  return tile
}

function achievementRow(
  standing: ProgressAchievementStanding,
): ProgressAchievementRowView {
  // An unlocked goal is whole, whatever its row says: a target lowered
  // after the fact must not leave a finished goal reading "12 / 10".
  const count = standing.unlocked
    ? standing.required
    : achievementCount(standing.progress, standing.required)
  return {
    id: standing.id,
    title: standing.name,
    detail: standing.description,
    icon: standing.icon,
    pointsLabel: `+${standing.points} pts`,
    unlocked: standing.unlocked,
    countLabel: `${count} / ${standing.required}`,
    percent: standing.unlocked ? 100 : achievementPercent(standing.progress),
  }
}

function summaryOf(recognition: ProgressRecognitionSummary): string {
  const { badges, achievements } = recognition
  if (badges.total === 0 && achievements.total === 0) {
    return 'Nothing to earn has been defined yet.'
  }
  const underWay =
    achievements.inProgress > 0 ? `, ${achievements.inProgress} under way` : ''
  return `${badges.earned} of ${badges.total} badges and ${achievements.unlocked} of ${achievements.total} achievements earned${underWay}.`
}

/**
 * Build the cabinet from the read model. The date formatter is handed in so
 * the cabinet reads the same as the rest of the page — one formatter, owned
 * by the view-model, and no import back into it.
 */
export function buildCabinet(
  model: ProgressModel,
  formatDate: DateLabel,
): ProgressCabinetView {
  const { recognition } = model
  const shelves: ProgressAchievementShelfView[] = ACHIEVEMENT_SHELVES.map(
    (shelf) => {
      const items = recognition.catalogue.achievements
        .filter((standing) => standing.category === shelf.id)
        .map(achievementRow)
      return {
        id: shelf.id,
        title: shelf.title,
        blurb: shelf.blurb,
        unlockedCount: items.filter((item) => item.unlocked).length,
        items,
      }
    },
  ).filter((shelf) => shelf.items.length > 0)

  return {
    available: recognition.available,
    summary: summaryOf(recognition),
    badgesLabel: `${recognition.badges.earned} / ${recognition.badges.total}`,
    achievementsLabel: `${recognition.achievements.unlocked} / ${recognition.achievements.total}`,
    badges: recognition.catalogue.badges.map((standing) =>
      badgeTile(standing, formatDate),
    ),
    shelves,
  }
}
