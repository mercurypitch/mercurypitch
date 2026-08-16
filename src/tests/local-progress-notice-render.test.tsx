// The notice only appears in a state that is awkward to reach by hand —
// signed in to an account made on another device, with local practice
// still on this one. So the render path gets its own test: that it shows
// at all, that it names what is actually here, and that dismissing it
// both closes it and makes it stay closed.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ids = { device: 'device-a', account: 'account-b' }
vi.mock('@/db/services/user-service', () => ({
  getDeviceId: () => ids.device,
  getUserId: () => ids.account,
  authVersion: () => 0,
}))

const { LocalProgressNotice } =
  await import('@/components/account/LocalProgressNotice')
const { clearExerciseHistory, exerciseHistory, recordExerciseResult } =
  await import('@/stores/exercise-history-store')

describe('LocalProgressNotice', () => {
  beforeEach(() => {
    localStorage.clear()
    ids.device = 'device-a'
    ids.account = 'account-b'
  })

  afterEach(cleanup)

  it('stays out of the way when the account is this device', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    ids.account = ids.device
    const { queryByTestId } = render(() => <LocalProgressNotice />)
    expect(queryByTestId('local-progress-notice')).toBeNull()
  })

  it('names what is actually on the device, and promises it back', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    const { getByTestId } = render(() => <LocalProgressNotice />)
    const dialog = getByTestId('local-progress-notice')

    // The count comes from the store, not from the test — the failure
    // this guards against is text wired to the wrong place, or to nothing.
    const n = exerciseHistory().length
    expect(n).toBeGreaterThan(0)
    expect(dialog.textContent).toContain(`${n} exercise`)
    // The reassurance is the point of the whole notice.
    expect(dialog.textContent).toContain('Nothing was deleted')
  })

  it('speaks in the singular about a single exercise', () => {
    // CLAUDE-JOURNEY-016: the sentence was a fixed template ending in
    // "are", so one exercise read "The 1 exercise you did here are".
    clearExerciseHistory()
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    expect(exerciseHistory().length).toBe(1)
    const { getByTestId } = render(() => <LocalProgressNotice />)
    const text = getByTestId('local-progress-notice').textContent ?? ''
    expect(text).toContain('1 exercise you did here is still')
    expect(text).not.toContain('you did here are')
  })

  it('keeps the plural for more than one thing', () => {
    clearExerciseHistory()
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    recordExerciseResult({
      type: 'pitch-hold',
      score: 70,
      metrics: {},
      completedAt: 2,
    })
    expect(exerciseHistory().length).toBe(2)
    const { getByTestId } = render(() => <LocalProgressNotice />)
    const text = getByTestId('local-progress-notice').textContent ?? ''
    expect(text).toContain('2 exercises you did here are still')
  })

  it('offers a mail draft carrying both ids', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    const { getByTestId } = render(() => <LocalProgressNotice />)
    const href =
      getByTestId('local-progress-contact').getAttribute('href') ?? ''
    const decoded = decodeURIComponent(href)

    expect(decoded).toContain('device: device-a')
    expect(decoded).toContain('account: account-b')
  })

  it('closes on Got it and does not come back', () => {
    recordExerciseResult({
      type: 'long-note',
      score: 80,
      metrics: {},
      completedAt: 1,
    })
    const first = render(() => <LocalProgressNotice />)
    first.getByTestId('local-progress-ok').click()
    expect(first.queryByTestId('local-progress-notice')).toBeNull()
    cleanup()

    // A fresh mount is the next page load: the dismissal has to have
    // reached storage, not just a signal.
    const second = render(() => <LocalProgressNotice />)
    expect(second.queryByTestId('local-progress-notice')).toBeNull()
  })
})
