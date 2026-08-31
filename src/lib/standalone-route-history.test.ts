// Standalone route history tests exercise real pointer movement and shared guards.
// ============================================================

import { waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireLocalSaveNavigationLock } from './local-save-navigation-lock'
import { acquireStandaloneRouteHistory } from './standalone-route-history'

describe('standalone route history', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('reverses Back and Forward once when two room controllers guard the route', async () => {
    window.history.replaceState(
      { existingState: 'preserved' },
      '',
      '/guitar-night?step=zero',
    )
    const first = acquireStandaloneRouteHistory('guitar-night')
    const second = acquireStandaloneRouteHistory('guitar-night')
    first.acceptCurrent()
    expect(window.history.state).toMatchObject({
      existingState: 'preserved',
    })
    first.write('/guitar-night?step=one', 'push')
    first.write('/guitar-night?step=two', 'push')

    window.history.back()
    await waitFor(() => expect(window.location.search).toBe('?step=one'))
    first.acceptCurrent()

    const visited: string[] = []
    const firstListener = (event: PopStateEvent): void => {
      visited.push(window.location.search)
      first.vetoLockedPopState(event)
    }
    const secondListener = (event: PopStateEvent): void => {
      second.vetoLockedPopState(event)
    }
    window.addEventListener('popstate', firstListener)
    window.addEventListener('popstate', secondListener)
    const go = vi.spyOn(window.history, 'go')
    const releaseLock = acquireLocalSaveNavigationLock(
      'standalone history test',
    )

    try {
      window.history.back()
      await waitFor(() => expect(visited).toEqual(['?step=zero', '?step=one']))
      expect(go).toHaveBeenCalledTimes(1)
      expect(go).toHaveBeenLastCalledWith(1)

      visited.length = 0
      window.history.forward()
      await waitFor(() => expect(visited).toEqual(['?step=two', '?step=one']))
      expect(go).toHaveBeenCalledTimes(2)
      expect(go).toHaveBeenLastCalledWith(-1)
    } finally {
      releaseLock()
      go.mockRestore()
      window.removeEventListener('popstate', firstListener)
      window.removeEventListener('popstate', secondListener)
      first.release()
      second.release()
    }
  })
})
