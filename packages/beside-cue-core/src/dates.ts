// ============================================================
// Local calendar dates — timezone-free arithmetic for progress windows
// ============================================================

import { CueDomainError } from './errors'
import type { LocalDate } from './types'

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u

function parseLocalDate(value: LocalDate): Date {
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (match === null) {
    throw new CueDomainError(
      'invalid_local_date',
      `Invalid local calendar date: ${value}`,
    )
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new CueDomainError(
      'invalid_local_date',
      `Invalid local calendar date: ${value}`,
    )
  }

  return date
}

function formatLocalDate(date: Date): LocalDate {
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function assertLocalDate(value: LocalDate): void {
  parseLocalDate(value)
}

export function addLocalDays(value: LocalDate, days: number): LocalDate {
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new CueDomainError(
      'invalid_day_offset',
      `Day offset must be a finite integer: ${days}`,
    )
  }

  const date = parseLocalDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  const result = formatLocalDate(date)
  assertLocalDate(result)
  return result
}
