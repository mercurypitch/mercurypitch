// Loading lifecycle regression — readiness requires installed art, one rendered frame and only the initial minimum.

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureLoadingState } from './loading-lifecycle'
import { createAdventureLoadingLifecycle } from './loading-lifecycle'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})

afterEach(() => {
  vi.useRealTimers()
})

function fixture() {
  const states: AdventureLoadingState[] = []
  const lifecycle = createAdventureLoadingLifecycle({
    minimumVisibleMs: 2000,
    now: () => Date.now(),
    onChange: (state) => states.push(state),
  })
  return { lifecycle, states }
}

it('waits for a frame after installation and the initial presentation minimum', () => {
  const { lifecycle, states } = fixture()
  const generation = lifecycle.beginAttempt()

  vi.advanceTimersByTime(400)
  expect(lifecycle.assetsInstalled(generation)).toBe(true)
  expect(states.at(-1)?.phase).toBe('awaiting-first-frame')
  vi.advanceTimersByTime(1600)
  expect(states.at(-1)?.phase).toBe('awaiting-first-frame')

  expect(lifecycle.frameRendered(generation)).toBe(true)
  expect(states.at(-1)?.phase).toBe('ready')
})

it('holds a fast stable frame only for the remaining initial minimum', () => {
  const { lifecycle, states } = fixture()
  const generation = lifecycle.beginAttempt()
  vi.advanceTimersByTime(350)
  lifecycle.assetsInstalled(generation)
  lifecycle.frameRendered(generation)

  vi.advanceTimersByTime(1649)
  expect(states.at(-1)?.phase).toBe('awaiting-first-frame')
  vi.advanceTimersByTime(1)
  expect(states.at(-1)?.phase).toBe('awaiting-first-frame')
  lifecycle.frameRendered(generation)
  expect(states.at(-1)?.phase).toBe('ready')
})

it('does not restart the minimum on retry and ignores stale attempts', () => {
  const { lifecycle, states } = fixture()
  const first = lifecycle.beginAttempt()
  vi.advanceTimersByTime(700)
  lifecycle.fail(first, 'first load failed')

  vi.advanceTimersByTime(1500)
  const retry = lifecycle.beginAttempt()
  expect(lifecycle.assetsInstalled(first)).toBe(false)
  expect(lifecycle.frameRendered(first)).toBe(false)
  expect(lifecycle.fail(first, 'late failure')).toBe(false)

  lifecycle.assetsInstalled(retry)
  lifecycle.frameRendered(retry)
  expect(states.at(-1)).toMatchObject({
    generation: retry,
    phase: 'ready',
    error: null,
  })
})

it('keeps progress monotonic, freezes errors and resets a retry generation', () => {
  const { lifecycle, states } = fixture()
  const first = lifecycle.beginAttempt()
  expect(
    lifecycle.reportProgress(first, { completedUnits: 0, totalUnits: 3 }),
  ).toBe(true)
  expect(
    lifecycle.reportProgress(first, { completedUnits: 1, totalUnits: 3 }),
  ).toBe(true)
  expect(
    lifecycle.reportProgress(first, { completedUnits: 0, totalUnits: 3 }),
  ).toBe(false)
  expect(
    lifecycle.reportProgress(first, { completedUnits: 2, totalUnits: 4 }),
  ).toBe(false)
  lifecycle.fail(first, 'required art failed')
  expect(
    lifecycle.reportProgress(first, { completedUnits: 2, totalUnits: 3 }),
  ).toBe(false)
  expect(states.at(-1)).toMatchObject({
    generation: first,
    phase: 'error',
    progress: { completedUnits: 1, totalUnits: 3 },
  })

  const retry = lifecycle.beginAttempt()
  expect(states.at(-1)).toMatchObject({
    generation: retry,
    phase: 'loading-assets',
    progress: { completedUnits: 0, totalUnits: 0 },
  })
  expect(
    lifecycle.reportProgress(first, { completedUnits: 3, totalUnits: 3 }),
  ).toBe(false)
  expect(
    lifecycle.reportProgress(retry, { completedUnits: 0, totalUnits: 2 }),
  ).toBe(true)
  expect(
    lifecycle.reportProgress(retry, { completedUnits: 2, totalUnits: 2 }),
  ).toBe(true)
  expect(lifecycle.assetsInstalled(retry)).toBe(true)
})

it('does not enter the frame gate before every declared unit is installed', () => {
  const { lifecycle, states } = fixture()
  const generation = lifecycle.beginAttempt()
  lifecycle.reportProgress(generation, { completedUnits: 0, totalUnits: 2 })
  lifecycle.reportProgress(generation, { completedUnits: 1, totalUnits: 2 })

  expect(lifecycle.assetsInstalled(generation)).toBe(false)
  expect(states.at(-1)?.phase).toBe('loading-assets')

  lifecycle.reportProgress(generation, { completedUnits: 2, totalUnits: 2 })
  expect(lifecycle.assetsInstalled(generation)).toBe(true)
  expect(states.at(-1)?.phase).toBe('awaiting-first-frame')
})

it('requires an active attempt when a later frame reaches the deadline', () => {
  const first = fixture()
  const failed = first.lifecycle.beginAttempt()
  first.lifecycle.assetsInstalled(failed)
  first.lifecycle.frameRendered(failed)
  first.lifecycle.fail(failed, 'graphics stopped')
  expect(first.lifecycle.fail(failed, 'late asset rejection')).toBe(false)
  vi.advanceTimersByTime(2500)
  expect(first.lifecycle.frameRendered(failed)).toBe(false)
  expect(first.states.at(-1)).toMatchObject({
    phase: 'error',
    error: 'graphics stopped',
  })

  const second = fixture()
  const disposed = second.lifecycle.beginAttempt()
  second.lifecycle.assetsInstalled(disposed)
  second.lifecycle.frameRendered(disposed)
  second.lifecycle.dispose()
  vi.advanceTimersByTime(2500)
  expect(second.lifecycle.frameRendered(disposed)).toBe(false)
  expect(second.states.at(-1)?.phase).toBe('awaiting-first-frame')
})
