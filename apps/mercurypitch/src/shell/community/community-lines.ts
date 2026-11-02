// ============================================================
// Community lines — the Community screens' words, from what they show
// ============================================================
//
// Pure, so the wording is tested without drawing a screen. Plain and short,
// as the Leagues screen's: a count is words ("3 runs"), a date is the day it
// was shared, and a state says what happened and what the singer can do.
// The figures are ProfileView's (src/features/community/ProfileView.tsx),
// worked out by the same run-kinds module, so the phone's best and the
// web's agree.

import type { PublishedShareCounts, SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'
import type { ProgressRun } from '@/features/progress/run-kinds'
import { bestScore, recentAverageScore } from '@/features/progress/run-kinds'
import { thisDeviceLower } from '@/lib/device-noun'

/** "1 run", "3 runs". */
function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "2 Nov", or "2 Nov 2025" for a day in another year. */
export function sharedOn(at: number, nowMs: number = Date.now()): string {
  const day = new Date(at)
  if (Number.isNaN(day.getTime())) return ''
  const sameYear = day.getFullYear() === new Date(nowMs).getFullYear()
  return day.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** The notes a melody holds, rests left out. */
export function noteCount(melody: SharedMelodyView): number {
  return melody.items.filter((item) => item.isRest !== true).length
}

/**
 * Under a melody's name: who shared it, how many notes, and when. Facts, not
 * one string, so the row can wrap between them and never inside one.
 */
export function melodyFacts(
  melody: SharedMelodyView,
  nowMs?: number,
): string[] {
  const when = sharedOn(melody.date, nowMs)
  const notes = counted(noteCount(melody), 'note', 'notes')
  return [`by ${melody.author}`, notes, when].filter((part) => part !== '')
}

/**
 * The name of a share's "...": the share and its singer, so two shares by
 * one singer are two buttons a screen reader tells apart.
 */
export function shareMoreLabel(share: {
  name: string
  author: string
}): string {
  return `More about ${share.name}, by ${share.author}`
}

/** A result's scores, averaged and rounded: what its row shows. */
export function resultAverage(result: SharedSessionView): number {
  if (result.results.length === 0) return 0
  const total = result.results.reduce((sum, score) => sum + score, 0)
  return Math.round(total / result.results.length)
}

/** Under a result's name: who shared it, how many runs, and when. */
export function resultFacts(
  result: SharedSessionView,
  nowMs?: number,
): string[] {
  const when = sharedOn(result.date, nowMs)
  const runs = counted(result.results.length, 'run', 'runs')
  return [`by ${result.author}`, runs, when].filter((part) => part !== '')
}

/** One of the profile's figures: the number, and what it counts. */
export interface ProfileFigure {
  id: 'runs' | 'best' | 'recent' | 'streak'
  value: string
  label: string
}

/**
 * The profile's figures, as ProfileView draws them: how many runs, the
 * best, the recent average, and the streak once there is one. Nothing for
 * a singer with no runs: "best 0%" reads as a bad result, not an empty one.
 */
export function profileFigures(
  runs: readonly ProgressRun[],
  totalRuns: number,
  streak: number,
): ProfileFigure[] {
  if (runs.length === 0) return []
  const count = Math.max(totalRuns, runs.length)
  const figures: ProfileFigure[] = [
    { id: 'runs', value: String(count), label: count === 1 ? 'run' : 'runs' },
    { id: 'best', value: `${bestScore(runs)}%`, label: 'best' },
    {
      id: 'recent',
      value: `${recentAverageScore(runs)}%`,
      label: 'recent average',
    },
  ]
  if (streak > 0) {
    figures.push({
      id: 'streak',
      value: String(streak),
      label: streak === 1 ? 'day streak' : 'days running',
    })
  }
  return figures
}

/** "You shared 2 melodies and 1 result", or null for nothing shared. */
export function publishedLine(
  published: PublishedShareCounts | null,
): string | null {
  if (published === null) return null
  const parts: string[] = []
  if (published.melodies > 0) {
    parts.push(counted(published.melodies, 'melody', 'melodies'))
  }
  if (published.sessions > 0) {
    parts.push(counted(published.sessions, 'result', 'results'))
  }
  return parts.length === 0 ? null : `You shared ${parts.join(' and ')}`
}

/** "Member since October 2026", or null when the profile was not read. */
export function memberSince(joinedAt: number | null): string | null {
  if (joinedAt === null || !Number.isFinite(joinedAt)) return null
  const month = new Date(joinedAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  return `Member since ${month}`
}

/** While the first read for this account is out. */
export const COMMUNITY_LOADING = 'Loading what singers shared'

/** Nothing on either list. */
export const COMMUNITY_EMPTY =
  'Nothing shared yet. When singers share a melody or a result, it shows here.'

export const MELODIES_EMPTY = 'No melodies shared yet.'
export const RESULTS_EMPTY = 'No results shared yet.'

/** Over the results: what a shared result is. */
export const RESULTS_ABOUT =
  'Results singers shared from their runs. Viewing one does not add a run to your practice history.'

/** A read that got no answer, or no answer worth reading. */
export const COMMUNITY_FAILED = {
  title: 'Could not load Community.',
  body: 'Check the connection and try again.',
} as const

/** A read the phone did not send: it knows it is offline. */
export function offlineWords(): { title: string; body: string } {
  return {
    title: 'You are offline.',
    body: `Community shows what singers shared once ${thisDeviceLower()} is online again.`,
  }
}

/** The profile, with nobody signed in. */
export const PROFILE_SIGNED_OUT = {
  title: 'Your profile',
  body: 'Sign in to see your runs, your best and your streak here.',
} as const

/** A signed-in singer with no runs yet. */
export const PROFILE_EMPTY =
  'Nothing to show yet. Finish a run and your figures start filling in here.'

/** The foot of the screen: the contact form, for what a "..." cannot say. */
export const CONTACT_LEAD = 'Something here that should not be?'

/** The first line of the contact form's message, opened from Community. */
export const CONTACT_MESSAGE = 'About Community on the phone:\n\n'

/** A shared result, opened: what it is not. */
export const RESULT_NOTE =
  'This is a shared result. Viewing it does not add a run to your practice history.'

/** A result no longer in what the phone read. */
export const RESULT_GONE =
  'This shared result is not here any more. It may have been taken down.'

/** A result opened for an account that is no longer the one signed in. */
export function resultAccountWords(): string {
  return `The account on ${thisDeviceLower()} changed since you opened this result. Go back to Community to see what is shared now.`
}
