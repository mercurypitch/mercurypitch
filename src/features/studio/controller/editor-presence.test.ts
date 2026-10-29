// Studio editor presence — the project's Web Lock, against a lock manager that keeps the spec's order.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorPresence } from './editor-presence'
import { editorLockName, lockEditorPresence, openLockName, UNPROVEN_EDITOR_PRESENCE, } from './editor-presence'

interface Request {
  name: string
  mode: LockMode
  callback: LockGrantedCallback<unknown>
  resolve(value: unknown): void
  reject(reason: unknown): void
}

/**
 * Locks as the Web Locks spec orders them, for one origin: an exclusive
 * holder or any number of shared ones per name, waiters in turn, a `signal`
 * that drops a waiting request, a `steal` that takes the lock at once and
 * fails the holders' requests, and `query` listing what is held.
 */
function fakeLocks() {
  const held: Request[] = []
  const waiting: Request[] = []

  const fits = (request: Request) => {
    const holders = held.filter((holder) => holder.name === request.name)
    return request.mode === 'shared'
      ? holders.every((holder) => holder.mode === 'shared')
      : holders.length === 0
  }

  function grant(request: Request): void {
    held.push(request)
    void Promise.resolve(
      request.callback({ name: request.name, mode: request.mode }),
    ).then((value) => {
      const index = held.indexOf(request)
      if (index < 0) return
      held.splice(index, 1)
      request.resolve(value)
      for (const next of [...waiting]) {
        const first = waiting.find((other) => other.name === next.name)
        if (first !== next || !fits(next)) continue
        waiting.splice(waiting.indexOf(next), 1)
        grant(next)
      }
    })
  }

  const locks = {
    request(
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const request: Request = {
          name,
          mode: options.mode ?? 'exclusive',
          callback,
          resolve,
          reject,
        }
        if (options.steal === true) {
          for (const holder of held.filter((other) => other.name === name)) {
            held.splice(held.indexOf(holder), 1)
            holder.reject(new DOMException('Lock stolen', 'AbortError'))
          }
          grant(request)
          return
        }
        if (!waiting.some((other) => other.name === name) && fits(request)) {
          grant(request)
          return
        }
        waiting.push(request)
        options.signal?.addEventListener('abort', () => {
          const index = waiting.indexOf(request)
          if (index < 0) return
          waiting.splice(index, 1)
          reject(new DOMException('Lock request aborted', 'AbortError'))
        })
      })
    },
    query: () =>
      Promise.resolve({
        held: held.map(({ name, mode }) => ({ name, mode, clientId: 'tab' })),
        pending: waiting.map(({ name, mode }) => ({
          name,
          mode,
          clientId: 'tab',
        })),
      }),
  } as unknown as LockManager
  return {
    locks,
    holds: (name: string) => held.some((holder) => holder.name === name),
  }
}

/** Let a release reach the fake lock manager. */
const settle = async () => {
  for (let turn = 0; turn < 4; turn++) await Promise.resolve()
}

const claim = { waitMs: 1000, steal: false }
const settled = (promise: Promise<unknown>) =>
  Promise.race([promise.then(() => true), Promise.resolve(false)])

afterEach(() => {
  vi.useRealTimers()
})

describe('Studio editor presence', () => {
  it('grants a free project at once, and proves no other tab edits it', async () => {
    const { locks, holds } = fakeLocks()
    const presence = await lockEditorPresence(locks).claim('one', claim)

    expect(presence?.exclusive).toBe(true)
    expect(holds(editorLockName('one'))).toBe(true)
    expect(holds(editorLockName('two'))).toBe(false)
  })

  it('calls a project held past the wait another tab’s, and leaves that tab holding it', async () => {
    vi.useFakeTimers()
    const { locks } = fakeLocks()
    const source = lockEditorPresence(locks)
    const first = (await source.claim('one', claim))!

    const second = source.claim('one', claim)
    await vi.advanceTimersByTimeAsync(999)
    expect(await settled(second)).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(await second).toBeNull()
    expect(await settled(first.lost)).toBe(false)
  })

  it('grants a project whose holder lets go within the wait, as a reload’s old page does', async () => {
    vi.useFakeTimers()
    const { locks } = fakeLocks()
    const source = lockEditorPresence(locks)
    const leaving = (await source.claim('one', claim))!

    const reloaded = source.claim('one', claim)
    await vi.advanceTimersByTimeAsync(300)
    leaving.release()
    await vi.advanceTimersByTimeAsync(0)

    expect((await reloaded)?.exclusive).toBe(true)
    expect(await settled(leaving.lost)).toBe(false)
  })

  it('takes a project at once on a steal, and tells the tab that held it', async () => {
    const { locks, holds } = fakeLocks()
    const source = lockEditorPresence(locks)
    const first = (await source.claim('one', claim))!

    const taken = await source.claim('one', { waitMs: 1000, steal: true })
    await first.lost

    expect(taken?.exclusive).toBe(true)
    expect(holds(editorLockName('one'))).toBe(true)
  })

  it('frees the project on release for the next claim', async () => {
    const { locks, holds } = fakeLocks()
    const source = lockEditorPresence(locks)
    const first = (await source.claim('one', claim))!
    first.release()
    await settle()

    expect(holds(editorLockName('one'))).toBe(false)
    const next: EditorPresence | null = await source.claim('one', claim)
    expect(next?.exclusive).toBe(true)
  })

  it('shares a song every tab that loads it holds, and calls a tab alone with it only when no other has it', async () => {
    const { locks, holds } = fakeLocks()
    const here = lockEditorPresence(locks)
    const there = lockEditorPresence(locks)

    const mine = await here.open('one')
    expect(holds(openLockName('one'))).toBe(true)
    expect(await mine.alone()).toBe(true)
    const theirs = await there.open('one')
    const elsewhere = await there.open('two')
    expect(await mine.alone()).toBe(false)
    expect(await theirs.alone()).toBe(false)
    theirs.release()
    await settle()

    expect(await mine.alone()).toBe(true)
    expect(await elsewhere.alone()).toBe(true)
  })

  it('lets the editor lock and the shared song lock be held apart', async () => {
    const { locks } = fakeLocks()
    const source = lockEditorPresence(locks)
    const opened = await source.open('one')

    const editor = await source.claim('one', claim)

    expect(editor?.exclusive).toBe(true)
    expect(await opened.alone()).toBe(true)
  })

  it('is never alone with a song without Web Locks, or where the lock manager refuses the page', async () => {
    const refusing = {
      request: () =>
        Promise.reject(new DOMException('Opaque origin', 'SecurityError')),
      query: () =>
        Promise.reject(new DOMException('Opaque origin', 'SecurityError')),
    } as unknown as LockManager

    expect(await (await UNPROVEN_EDITOR_PRESENCE.open('one')).alone()).toBe(
      false,
    )
    expect(await (await lockEditorPresence(refusing).open('one')).alone()).toBe(
      false,
    )
  })

  it('falls back to the lease alone when the lock manager refuses the page', async () => {
    const refusing = {
      request: () =>
        Promise.reject(new DOMException('Opaque origin', 'SecurityError')),
    } as unknown as LockManager

    const presence = await lockEditorPresence(refusing).claim('one', claim)

    expect(presence?.exclusive).toBe(false)
    expect(await UNPROVEN_EDITOR_PRESENCE.claim('one', claim)).toEqual(presence)
  })
})
