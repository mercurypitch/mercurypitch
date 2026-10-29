// ============================================================
// Local-save navigation lock — lease, veto, and reactive cleanup contracts
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireLocalSaveNavigationLock, isLocalSaveNavigationLocked, useLocalSaveNavigationLock, vetoNavigationDuringLocalSave, } from '@/lib/local-save-navigation-lock'
import { useBeforeUnloadGuard } from '@/lib/use-before-unload-guard'

afterEach(() => {
  cleanup()
  expect(isLocalSaveNavigationLocked()).toBe(false)
})

describe('local-save navigation leases', () => {
  it('keeps independent saves locked until every lease releases', () => {
    const releaseExercise = acquireLocalSaveNavigationLock('exercise')
    const releaseKaraoke = acquireLocalSaveNavigationLock('karaoke')

    expect(isLocalSaveNavigationLocked()).toBe(true)
    releaseExercise()
    releaseExercise()
    expect(isLocalSaveNavigationLocked()).toBe(true)

    releaseKaraoke()
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })

  it('releases a reactive lease when saving settles or its owner unmounts', () => {
    let setSaving: ((saving: boolean) => void) | undefined
    const Harness: Component = () => {
      const [saving, updateSaving] = createSignal(false)
      setSaving = updateSaving
      useLocalSaveNavigationLock(saving, 'test save')
      return null
    }
    const mounted = render(() => <Harness />)

    expect(isLocalSaveNavigationLocked()).toBe(false)
    setSaving?.(true)
    expect(isLocalSaveNavigationLocked()).toBe(true)
    setSaving?.(false)
    expect(isLocalSaveNavigationLocked()).toBe(false)

    setSaving?.(true)
    expect(isLocalSaveNavigationLocked()).toBe(true)
    mounted.unmount()
    expect(isLocalSaveNavigationLocked()).toBe(false)
  })
})

describe('central app navigation veto', () => {
  it('rejects navigation during Keep and lets the request continue after release', () => {
    const onBlocked = vi.fn()
    const onResolved = vi.fn()
    const requestNavigation = (): void => {
      if (
        vetoNavigationDuringLocalSave({
          onBlocked,
          onResolved,
        })
      ) {
        return
      }
      onResolved(true)
    }
    const release = acquireLocalSaveNavigationLock('voice take')

    requestNavigation()
    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onResolved).toHaveBeenLastCalledWith(false)

    release()
    requestNavigation()
    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onResolved).toHaveBeenLastCalledWith(true)
  })

  it('drives the full-page unload guard from the same registry', () => {
    const Harness: Component = () => {
      useBeforeUnloadGuard(isLocalSaveNavigationLocked)
      return null
    }
    render(() => <Harness />)

    const release = acquireLocalSaveNavigationLock('voice take')
    const savingEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(savingEvent)
    expect(savingEvent.defaultPrevented).toBe(true)

    release()
    const settledEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(settledEvent)
    expect(settledEvent.defaultPrevented).toBe(false)
  })
})
