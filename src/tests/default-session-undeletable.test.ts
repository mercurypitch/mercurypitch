// ============================================================
// The Default Session cannot be deleted, and says so
// ============================================================
//
// Deleting "Default Session" used to produce a confirm dialog, a
// `Deleted "Default Session"` toast, an Undo button — and a session that was
// still there. It came back because `getDefaultSession()` rebuilds and
// persists it whenever it is missing, and half the app reaches for that on the
// way to listing sessions: `getAll()` does, and so does the Library tab, on
// every render.
//
// The rebuild is not a leak to plug. It is what restores the session after a
// "reset all data", and the reset path has no other way to ask. What was wrong
// was the offer. So the store now answers the question honestly — the session
// is permanent, `deleteSession` refuses it, and the modal does not draw a
// trash can it cannot deliver on.
//
// The first test here is the reproduction: it deletes, then reads sessions the
// way the UI does, and finds the session back. Before the fix it was the whole
// bug; now it is the reason the fix has to live in the store rather than in
// the button.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MelodyStore from '@/stores/melody-store'
import type * as SessionStore from '@/stores/session-store'
import type { PlaybackSession } from '@/types'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

/** A freshly seeded library, as a first launch leaves it. */
async function seeded(): Promise<{
  store: typeof MelodyStore
  sessions: typeof SessionStore
}> {
  const store = await import('@/stores/melody-store')
  store.seedDefaultSession()
  const sessions = await import('@/stores/session-store')
  return { store, sessions }
}

describe('the Default Session is permanent', () => {
  it('comes straight back from any listing, which is why deleting it is refused', async () => {
    const { store, sessions } = await seeded()

    // The reproduction, with the guard removed from the picture: take the
    // session out of storage by hand, then read it the way the Library tab
    // does. `getAll()` funnels into `getDefaultSession()`, which rebuilds.
    const all = store.getMelodyLibrary().sessions
    delete all['default']
    store._setMelodyLibrary({ sessions: all })

    expect(sessions.getAll()['default']).not.toBeNull()
    expect(sessions.getAll()['default']?.name).toBe('Default Session')

    // And the rebuild is persisted, so it survives the next read too.
    expect(store.getMelodyLibrary().sessions['default']).toBeDefined()
  })

  it('refuses the delete and leaves the session in place', async () => {
    const { store, sessions } = await seeded()

    expect(sessions.deleteSession('default')).toBe(false)
    expect(sessions.getSession('default')).toBeDefined()
    expect(store.getSessions().map((s) => s.id)).toContain('default')
  })

  it('reports the refusal through melodyStore too, so callers can be honest', async () => {
    const { store } = await seeded()

    // The modal shows `Deleted "..."` off this return value. It used to be
    // void and the toast fired unconditionally, which is how a refused delete
    // came to announce a success.
    expect(store.deleteSession('default')).toBe(false)
  })

  it('still deletes sessions the singer actually made', async () => {
    const { sessions } = await seeded()

    const mine: PlaybackSession = {
      id: 'session-mine',
      name: 'My Warmup',
      deletable: true,
      created: 0,
      items: [],
    }
    sessions.saveSession(mine)
    expect(sessions.getSession('session-mine')).toBeDefined()

    // The permanence is about one specific session, not about sessions.
    expect(sessions.deleteSession('session-mine')).toBe(true)
    expect(sessions.getSession('session-mine')).toBeUndefined()
  })

  it('still refuses locked internal sessions', async () => {
    const { sessions } = await seeded()

    const locked: PlaybackSession = {
      id: 'session-locked',
      name: 'Internal',
      deletable: false,
      created: 0,
      items: [],
    }
    sessions.saveSession(locked)

    // `deletable: false` was the pre-existing rule and it still holds — the
    // new check sits in front of it rather than replacing it.
    expect(sessions.deleteSession('session-locked')).toBe(false)
    expect(sessions.getSession('session-locked')).toBeDefined()
  })

  it('leaves a reset-all-data free to clear and reseed it', async () => {
    const { store, sessions } = await seeded()

    // Refusing a delete must not make the session unclearable — "reset all
    // data" goes through resetMelodyLibrary, not deleteSession, and the
    // singer who asks for that means it.
    sessions.resetAllSessions()
    store.seedDefaultSession()

    expect(sessions.getSession('default')).toBeDefined()
  })
})

describe('isDeletableSession', () => {
  it('names the one session that cannot go, and the flag that still counts', async () => {
    const { isDeletableSession, DEFAULT_SESSION_ID } =
      await import('@/stores/session-store')
    const s = (id: string, deletable: boolean): PlaybackSession => ({
      id,
      name: id,
      deletable,
      created: 0,
      items: [],
    })

    expect(DEFAULT_SESSION_ID).toBe('default')
    expect(isDeletableSession(s('default', true))).toBe(false)
    expect(isDeletableSession(s('session-1234', true))).toBe(true)
    // The older hole, closed by the same predicate: the list stopped
    // filtering on `deletable`, so a locked internal session had been given a
    // trash can that did nothing.
    expect(isDeletableSession(s('session-1234', false))).toBe(false)
    // Not a prefix or substring rule — only the exact id is permanent.
    expect(isDeletableSession(s('default-2', true))).toBe(true)
    expect(isDeletableSession(s('my-default', true))).toBe(true)
    // Nothing to delete is not something to delete.
    expect(isDeletableSession(undefined)).toBe(false)
    expect(isDeletableSession(null)).toBe(false)
  })
})
