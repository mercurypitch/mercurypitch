// Loading progress ledger regression — fixed plans advance once and freeze on failure.

import { expect, it, vi } from 'vitest'
import type { LoadingProgress } from './loading-progress'
import { createLoadingProgressLedger } from './loading-progress'

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
