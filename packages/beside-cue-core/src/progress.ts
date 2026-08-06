// ============================================================
// Gentle progress — trailing seven-day B-side counts across all cue history
// ============================================================

import { addLocalDays, assertLocalDate } from './dates'
import { assertOccurrenceStateInvariants } from './occurrences'
import type { BesideCueStateV1, LocalDate } from './types'

export interface DailyBSideCount {
  readonly date: LocalDate
  readonly count: number
}

export interface SevenDayBSideAggregation {
  readonly startDate: LocalDate
  readonly endDate: LocalDate
  readonly today: number
  readonly total: number
  readonly days: readonly DailyBSideCount[]
}

export function aggregateSevenDayBSides(
  state: BesideCueStateV1,
  throughDate: LocalDate,
): SevenDayBSideAggregation {
  assertLocalDate(throughDate)
  assertOccurrenceStateInvariants(state)

  const days = Array.from({ length: 7 }, (_, index) => ({
    date: addLocalDays(throughDate, index - 6),
    count: 0,
  }))
  const indexByDate = new Map(days.map((day, index) => [day.date, index]))

  for (const occurrence of state.occurrences) {
    if (occurrence.state !== 'resolved' || occurrence.outcome !== 'b_side') {
      continue
    }
    const index = indexByDate.get(occurrence.outcomeLocalDate)
    if (index !== undefined) days[index].count += 1
  }

  return {
    startDate: days[0].date,
    endDate: days[6].date,
    today: days[6].count,
    total: days.reduce((sum, day) => sum + day.count, 0),
    days,
  }
}
