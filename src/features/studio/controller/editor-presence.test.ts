// Studio editor presence — the project's Web Lock, against a lock manager that keeps the spec's order.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorPresence } from './editor-presence'
import { editorLockName, lockEditorPresence, UNPROVEN_EDITOR_PRESENCE, } from './editor-presence'

interface Request {
  callback: LockGrantedCallback<unknown>
  resolve(value: unknown): void
  reject(reason: unknown): void
}

/**
 * Exclusive locks only, as the Web Locks spec orders them: one holder per
 * name, waiters in turn, a `signal` that drops a waiting request, and a
 * `steal` that takes the lock at once and fails the holder's request.
 */
function fakeLocks() {
  const held = new Map<string, Request>()
  const waiting = new Map<string, Request[]>()

  function grant(name: string, request: Request): void {
    held.set(name, request)
    void Promise.resolve(request.callback({ name, mode: 'exclusive' })).then(
      (value) => {
        if (held.get(name) !== request) return
        held.delete(name)
        request.resolve(value)
        const next = waiting.get(name)?.shift()
        if (next) grant(name, next)
      },
    )
  }

  const locks = {
    request(
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const request: Request = { callback, resolve, reject }
        if (options.steal === true) {
          const holder = held.get(name)
          held.delete(name)
          holder?.reject(new DOMException('Lock stolen', 'AbortError'))
          grant(name, request)
          return
        }
        if (!held.has(name)) {
          grant(name, request)
          return
        }
        const queue = waiting.get(name) ?? []
        queue.push(request)
        waiting.set(name, queue)
        options.signal?.addEventListener('abort', () => {
          const index = queue.indexOf(request)
          if (index < 0) return
          queue.splice(index, 1)
          reject(new DOMException('Lock request aborted', 'AbortError'))
        })
      })
    },
    query: () => Promise.resolve({ held: [], pending: [] }),
  } as unknown as LockManager
  return { locks, holds: (name: string) => held.has(name) }
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
    await Promise.resolve()
    await Promise.resolve()

    expect(holds(editorLockName('one'))).toBe(false)
    const next: EditorPresence | null = await source.claim('one', claim)
    expect(next?.exclusive).toBe(true)
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
