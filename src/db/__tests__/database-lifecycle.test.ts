// ============================================================
// database-lifecycle tests
// ============================================================
// The rule these pin down is the one that cost a real device an unusable app:
// yielding to another tab's upgrade is not enough, the connection has to stay
// closed. See database-lifecycle.ts for the measurement.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LifecycleDatabase } from '../database-lifecycle'
import { databaseLifecycleState, databaseLifecycleVersion, installDatabaseLifecycle, onDatabaseLifecycle, resetDatabaseLifecycleForTests, } from '../database-lifecycle'

type Handler = (ev: { newVersion?: number | null; oldVersion?: number }) => void

/** A stand-in for the one Dexie connection, with its events under our control. */
function fakeDb() {
  const handlers = new Map<string, Handler[]>()
  const closes: { disableAutoOpen: boolean }[] = []
  const db: LifecycleDatabase = {
    on: (event, handler) => {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
      return undefined
    },
    close: (options) => {
      closes.push(options ?? { disableAutoOpen: false })
    },
  }
  return {
    db,
    closes,
    fire(event: 'versionchange' | 'blocked', ev: Parameters<Handler>[0] = {}) {
      for (const handler of handlers.get(event) ?? []) handler(ev)
    },
  }
}

afterEach(() => {
  resetDatabaseLifecycleForTests()
  vi.restoreAllMocks()
})

describe('installDatabaseLifecycle', () => {
  it('starts out reporting a usable database', () => {
    expect(databaseLifecycleState()).toBe('ok')
    expect(databaseLifecycleVersion()).toBeNull()
  })

  it('closes for good when another tab upgrades, so it cannot re-block', () => {
    const { db, closes, fire } = fakeDb()
    installDatabaseLifecycle(db)

    fire('versionchange', { newVersion: 120, oldVersion: 80 })

    // The whole defect in one assertion: Dexie's default closes with
    // `disableAutoOpen: false`, which lets the next query reopen at the old
    // version and starve the upgrading tab. Ours must disable auto-open.
    expect(closes).toEqual([{ disableAutoOpen: true }])
    expect(databaseLifecycleState()).toBe('superseded')
    expect(databaseLifecycleVersion()).toBe(120)
  })

  it('reports blocked when this tab is the one waiting', () => {
    const { db, closes, fire } = fakeDb()
    installDatabaseLifecycle(db)

    fire('blocked', { newVersion: 120, oldVersion: 80 })

    expect(databaseLifecycleState()).toBe('blocked')
    // Being blocked is the other tabs' fault; closing our own connection would
    // throw away the upgrade we are waiting to perform.
    expect(closes).toEqual([])
  })

  it('notifies subscribers, and stops once they unsubscribe', () => {
    const { db, fire } = fakeDb()
    installDatabaseLifecycle(db)
    const seen: string[] = []
    const off = onDatabaseLifecycle((e) => seen.push(e.state))

    fire('blocked', { newVersion: 120 })
    off()
    fire('versionchange', { newVersion: 120 })

    expect(seen).toEqual(['blocked'])
  })

  it('does not repeat an unchanged state', () => {
    const { db, fire } = fakeDb()
    installDatabaseLifecycle(db)
    const listener = vi.fn()
    onDatabaseLifecycle(listener)

    fire('blocked', { newVersion: 120 })
    fire('blocked', { newVersion: 120 })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps superseded terminal, so the advice never softens', () => {
    const { db, fire } = fakeDb()
    installDatabaseLifecycle(db)

    fire('versionchange', { newVersion: 120 })
    // An open that was already in flight can report blocked afterwards. If that
    // downgraded the state, the visitor would be told to close tabs when only a
    // reload can help them.
    fire('blocked', { newVersion: 120 })

    expect(databaseLifecycleState()).toBe('superseded')
  })

  it('still reports the tab superseded when closing throws', () => {
    const { fire } = fakeDb()
    const handlers = new Map<string, Handler[]>()
    const db: LifecycleDatabase = {
      on: (event, handler) => {
        const list = handlers.get(event) ?? []
        list.push(handler)
        handlers.set(event, list)
        return undefined
      },
      close: () => {
        throw new Error('close failed')
      },
    }
    installDatabaseLifecycle(db)
    for (const handler of handlers.get('versionchange') ?? [])
      handler({ newVersion: 120 })
    void fire

    // A close that throws leaves the tab just as unusable, so the visitor is
    // still told to reload rather than left looking at a dead page.
    expect(databaseLifecycleState()).toBe('superseded')
  })

  it('lets the remaining subscribers hear it when one of them throws', () => {
    const { db, fire } = fakeDb()
    installDatabaseLifecycle(db)
    const good = vi.fn()
    onDatabaseLifecycle(() => {
      throw new Error('subscriber blew up')
    })
    onDatabaseLifecycle(good)

    fire('versionchange', { newVersion: 120 })

    expect(good).toHaveBeenCalledWith({ state: 'superseded', newVersion: 120 })
  })

  it('tolerates an event with no version, which some browsers send', () => {
    const { db, fire } = fakeDb()
    installDatabaseLifecycle(db)

    fire('versionchange', {})

    expect(databaseLifecycleState()).toBe('superseded')
    expect(databaseLifecycleVersion()).toBeNull()
  })
})
