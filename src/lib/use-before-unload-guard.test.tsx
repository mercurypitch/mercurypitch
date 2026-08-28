import { cleanup, render } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { useBeforeUnloadGuard } from '@/lib/use-before-unload-guard'

afterEach(cleanup)

describe('useBeforeUnloadGuard', () => {
  it('blocks only while the guarded operation is active', () => {
    let setActive: ((active: boolean) => void) | undefined
    const Harness: Component = () => {
      const [active, updateActive] = createSignal(false)
      setActive = updateActive
      useBeforeUnloadGuard(active)
      return null
    }

    const mounted = render(() => <Harness />)

    const idleEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(idleEvent)
    expect(idleEvent.defaultPrevented).toBe(false)

    setActive?.(true)
    const savingEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(savingEvent)
    expect(savingEvent.defaultPrevented).toBe(true)

    setActive?.(false)
    const settledEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(settledEvent)
    expect(settledEvent.defaultPrevented).toBe(false)

    setActive?.(true)
    mounted.unmount()
    const unmountedEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unmountedEvent)
    expect(unmountedEvent.defaultPrevented).toBe(false)
  })
})
