// ============================================================
// plan-sync.harness.fixture: fresh modules, a writer that takes, and the pull that brings a record
// ============================================================
//
// What the sync's two test files both do before a case: load the store and the
// sync as a page load does (the store reads storage once, as it loads), answer
// the plan, hand the sync a writer that takes what it is given, and let the
// settings pull apply a record from another device. plan-sync.fixture.ts is
// data and builders only and touches no store, so what does touch it is here,
// in a module of its own. It asserts nothing.
//
// The modules are imported inside the functions, after `vi.resetModules()`: a
// static import would be the first load's copy, and the pull must reach the
// same copy of the storage the freshly loaded store was given.

import { vi } from 'vitest'
import type { PlanResponseV1 } from '@/db/services/survey-service'
import { PLAN_RECORD_KEY } from './plan-keys'
import type * as PlanStore from './plan-store'
import type * as PlanSync from './plan-sync'
import { LINES, NOW, TYPED } from './plan-sync.fixture'

/** A writer that takes the response, and the account check saying `upgraded`. */
export function accepting(upgraded = true) {
  const submit = vi.fn(async (_: PlanResponseV1): Promise<void> => undefined)
  return { upgraded: () => upgraded, submit }
}

/** Fresh modules (the store reads storage once, as it loads) and the sync. */
export async function fresh(): Promise<{
  store: typeof PlanStore
  sync: typeof PlanSync
}> {
  vi.resetModules()
  const store = await import('./plan-store')
  const sync = await import('./plan-sync')
  return { store, sync }
}

/** Fresh modules with TYPED and LINES answered at NOW, and a writer that takes them. */
export async function answered(upgraded = true) {
  const { store, sync } = await fresh()
  store.savePlanAnswers(TYPED, LINES, null, NOW)
  return { store, sync, deps: accepting(upgraded) }
}

/** The settings pull: a record from another device arrives, as the pull applies it. */
export async function pull(record: unknown): Promise<void> {
  const { applyPersistedValue } = await import('@/lib/storage')
  applyPersistedValue(PLAN_RECORD_KEY, JSON.stringify(record))
}
