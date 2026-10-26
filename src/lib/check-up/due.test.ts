// ============================================================
// Weekly Check-up — when one is due, and Home's "Not this week"
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKUP_CARD_DISMISSED_KEY, checkupCardShown, checkupDue, dismissCheckupCard, readCardDismissal, } from './due'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const SUNG = Date.parse('2026-10-19T12:00:00.000Z')
const take = (ms: number) => ({ takenAt: new Date(ms).toISOString() })

describe('checkupDue', () => {
  it.each([
    ['6 days 23 hours after the newest take', false, 6 * DAY + 23 * HOUR],
    ['exactly 7 days after it', true, 7 * DAY],
    ['two weeks after it', true, 14 * DAY],
  ])('%s, due: %s', (_when, due, sinceNewest) => {
    // Arrange
    const history = [take(SUNG - 10 * DAY), take(SUNG)]

    // Act
    const answer = checkupDue(history, SUNG + sinceNewest)

    // Assert
    expect(answer).toBe(due)
  })

  it('is never due with no take to come back to', () => {
    expect(checkupDue([], SUNG + 365 * DAY)).toBe(false)
  })

  it('reads the newest take, whatever order the history is in', () => {
    const history = [take(SUNG), take(SUNG - 30 * DAY)]

    expect(checkupDue(history, SUNG + 3 * DAY)).toBe(false)
  })

  it('skips a take whose date does not read', () => {
    const history = [{ takenAt: 'not a date' }, take(SUNG)]

    expect(checkupDue(history, SUNG + 7 * DAY)).toBe(true)
  })
})

describe("Home's card and its dismissal", () => {
  beforeEach(() => localStorage.clear())

  it('shows a due Check-up that was never sent away', () => {
    expect(checkupCardShown([take(SUNG)], null, SUNG + 8 * DAY)).toBe(true)
  })

  it('stays away for the week after "Not this week"', () => {
    const tapped = SUNG + 8 * DAY

    expect(checkupCardShown([take(SUNG)], tapped, tapped + 6 * DAY)).toBe(false)
  })

  it('comes back a week after "Not this week"', () => {
    const tapped = SUNG + 8 * DAY

    expect(checkupCardShown([take(SUNG)], tapped, tapped + 7 * DAY)).toBe(true)
  })

  it('does not show a Check-up that is not due, dismissed or not', () => {
    expect(checkupCardShown([take(SUNG)], null, SUNG + 2 * DAY)).toBe(false)
  })

  it('keeps the tap in storage and reads it back', () => {
    dismissCheckupCard(SUNG)

    expect(readCardDismissal()).toBe(SUNG)
    expect(localStorage.getItem(CHECKUP_CARD_DISMISSED_KEY)).toBe(String(SUNG))
  })

  it('reads no dismissal from storage that holds something else', () => {
    localStorage.setItem(CHECKUP_CARD_DISMISSED_KEY, 'yesterday')

    expect(readCardDismissal()).toBeNull()
  })
})
