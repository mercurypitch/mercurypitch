// ============================================================
// Local-save navigation reason — a hold that says why is quoted, one that does not is not
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireLocalSaveNavigationLock, isLocalSaveNavigationLocked, } from '@/lib/local-save-navigation-lock'
import { localSaveNavigationReason, useLocalSaveNavigationLockWithReason, } from '@/lib/local-save-navigation-reason'

const disposers: (() => void)[] = []

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  expect(isLocalSaveNavigationLocked()).toBe(false)
})

function useHoldWithReason(
  holding: () => boolean,
  reason: () => string,
): () => void {
  return createRoot((dispose) => {
    useLocalSaveNavigationLockWithReason(holding, 'project', reason)
    disposers.push(dispose)
    return dispose
  })
}

describe('local-save navigation reasons', () => {
  it('quotes the newest hold that says why, read when asked, and nothing for a hold that says nothing', () => {
    const releaseTake = acquireLocalSaveNavigationLock('voice take')
    disposers.push(releaseTake)
    expect(localSaveNavigationReason()).toBeNull()

    const [reason, setReason] = createSignal('Still saving.')
    const releaseProject = useHoldWithReason(() => true, reason)
    expect(isLocalSaveNavigationLocked()).toBe(true)
    expect(localSaveNavigationReason()).toBe('Still saving.')
    setReason('Could not save.')
    expect(localSaveNavigationReason()).toBe('Could not save.')

    const releaseLater = useHoldWithReason(
      () => true,
      () => 'Still adding audio.',
    )
    expect(localSaveNavigationReason()).toBe('Still adding audio.')
    releaseLater()
    expect(localSaveNavigationReason()).toBe('Could not save.')

    releaseProject()
    expect(localSaveNavigationReason()).toBeNull()
    expect(isLocalSaveNavigationLocked()).toBe(true)
    releaseTake()
  })

  it('holds and says why only while the surface holds', () => {
    const [holding, setHolding] = createSignal(false)
    useHoldWithReason(holding, () => 'Could not save.')
    expect(isLocalSaveNavigationLocked()).toBe(false)
    expect(localSaveNavigationReason()).toBeNull()

    setHolding(true)
    expect(isLocalSaveNavigationLocked()).toBe(true)
    expect(localSaveNavigationReason()).toBe('Could not save.')

    setHolding(false)
    expect(isLocalSaveNavigationLocked()).toBe(false)
    expect(localSaveNavigationReason()).toBeNull()
  })
})
