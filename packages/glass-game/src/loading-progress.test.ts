// Loading progress ledger regression — fixed plans advance once and freeze on failure.

import { afterEach, expect, it, vi } from 'vitest'
import type { LoadingProgress } from './loading-progress'
import { createLoadingProgressLedger } from './loading-progress'

afterEach(() => vi.unstubAllEnvs())

it('copies bounded pending logical IDs without changing progress or exposing mutable state', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  const ids = Array.from(
    { length: 12 },
    (_, index) => `asset:${index}:${'x'.repeat(110)}`,
  )
  const onProgress = vi.fn()
  const ledger = createLoadingProgressLedger(ids, onProgress)
  ledger.complete(ids[0]!)
  const snapshot = ledger.diagnosticSnapshot!()
  expect(snapshot).toEqual({
    completedUnits: 1,
    totalUnits: 12,
    lastCompletedUnitId: ids[0]!.slice(0, 100),
    pendingCount: 11,
    pendingUnitIds: ids.slice(1, 9).map((id) => id.slice(0, 100)),
  })
  snapshot.pendingUnitIds.length = 0
  expect(ledger.diagnosticSnapshot!().pendingUnitIds).toHaveLength(8)
  ledger.freeze()
  ledger.complete(ids[1]!)
  expect(ledger.diagnosticSnapshot!().completedUnits).toBe(1)
  expect(onProgress).toHaveBeenCalledTimes(2)
})

it('does not create diagnostic state outside the portable build', () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', '')
  expect(
    createLoadingProgressLedger(['merc:model'], vi.fn()).diagnosticSnapshot,
  ).toBeUndefined()
})

it('deduplicates the fixed plan and completes each logical unit once', () => {
  const updates: LoadingProgress[] = []
  const ledger = createLoadingProgressLedger(
    ['bundle:garden', 'bundle:garden', 'sky:museum'],
    (progress) => updates.push(progress),
  )

  expect(ledger.unitIds).toEqual(['bundle:garden', 'sky:museum'])
  expect(updates).toEqual([{ completedUnits: 0, totalUnits: 2 }])
  expect(ledger.complete('bundle:garden')).toBe(true)
  expect(ledger.complete('bundle:garden')).toBe(false)
  expect(ledger.complete('sky:museum')).toBe(true)
  expect(updates).toEqual([
    { completedUnits: 0, totalUnits: 2 },
    { completedUnits: 1, totalUnits: 2 },
    { completedUnits: 2, totalUnits: 2 },
  ])
})

it('freezes without publishing late completions and rejects unknown work', () => {
  const onProgress = vi.fn()
  const ledger = createLoadingProgressLedger(['merc:model'], onProgress)

  expect(() => ledger.complete('bundle:undeclared')).toThrow(
    'Unknown loading progress unit: bundle:undeclared',
  )
  ledger.freeze()
  expect(ledger.complete('merc:model')).toBe(false)
  expect(ledger.progress()).toEqual({ completedUnits: 0, totalUnits: 1 })
  expect(onProgress).toHaveBeenCalledTimes(1)
})
