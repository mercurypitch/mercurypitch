// ============================================================
// DatabaseLifecycleNotice
// ============================================================
// A superseded or blocked database breaks every surface at once, so the
// explanation cannot live inside one room's spinner — a superseded tab has no
// working surface left to read it on. These pin the shell-level notice: that
// it says nothing when nothing is wrong, that each state gets the advice that
// actually helps, and that only the recoverable one is allowed to be quiet.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseLifecycleNotice } from '@/components/DatabaseLifecycleNotice'
import type { LifecycleDatabase } from '@/db/database-lifecycle'
import { installDatabaseLifecycle, resetDatabaseLifecycleForTests, } from '@/db/database-lifecycle'

type Handler = (ev: { newVersion?: number | null; oldVersion?: number }) => void

/** The one connection, with its two events under the test's control. */
function fakeDb() {
  const handlers = new Map<string, Handler[]>()
  const db: LifecycleDatabase = {
    on: (event, handler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
      return undefined
    },
    close: () => undefined,
  }
  installDatabaseLifecycle(db)
  return (event: 'versionchange' | 'blocked') => {
    for (const handler of handlers.get(event) ?? [])
      handler({ newVersion: 120 })
  }
}

beforeEach(() => {
  resetDatabaseLifecycleForTests()
})

afterEach(() => {
  cleanup()
  resetDatabaseLifecycleForTests()
  vi.restoreAllMocks()
})

describe('DatabaseLifecycleNotice', () => {
  it('says nothing while the database is healthy', () => {
    render(() => <DatabaseLifecycleNotice />)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tells a superseded tab to reload, and offers the button that does it', () => {
    const fire = fakeDb()
    render(() => <DatabaseLifecycleNotice />)

    fire('versionchange')

    // An alert, not a status: nothing on this page will work again.
    const notice = screen.getByRole('alert')
    expect(notice.textContent).toContain('out of date')
    expect(notice.textContent).toContain('nothing has been lost')
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
  })

  it('reloads when that button is pressed', () => {
    const reload = vi.fn()
    // jsdom's location.reload is not configurable in place; replace the whole
    // accessor rather than the method.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })
    const fire = fakeDb()
    render(() => <DatabaseLifecycleNotice />)
    fire('versionchange')

    fireEvent.click(screen.getByRole('button', { name: /reload/i }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('tells a blocked tab to close the others, and offers no button', () => {
    const fire = fakeDb()
    render(() => <DatabaseLifecycleNotice />)

    fire('blocked')

    // A status, not an alert: it clears itself the moment the other tabs go,
    // and closing them is not something this page can do for anyone.
    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain('Close the other tabs')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps the reload advice once superseded, even if blocked arrives after', () => {
    const fire = fakeDb()
    render(() => <DatabaseLifecycleNotice />)

    fire('versionchange')
    // An open already in flight can report blocked afterwards. Softening the
    // message would tell someone to close tabs when only a reload can help.
    fire('blocked')

    expect(screen.getByRole('alert').textContent).toContain('out of date')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the state that was already set before it mounted', () => {
    const fire = fakeDb()
    // The event almost always fires before the shell finishes mounting; a
    // notice that only listened forward would stay silent for the one case
    // it exists to cover.
    fire('versionchange')

    render(() => <DatabaseLifecycleNotice />)

    expect(screen.getByRole('alert').textContent).toContain('out of date')
  })
})
