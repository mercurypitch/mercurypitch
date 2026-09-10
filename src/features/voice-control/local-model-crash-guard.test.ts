// ============================================================
// The second attempt is the one that kills the tab
// ============================================================
//
// A phone that runs out of memory loading whisper does not report an error —
// WebKit kills the content process and the browser puts the same document
// back. Because the engine preference and the enable flag both persist, that
// fresh document starts the identical load, and it is the SECOND kill the
// user experiences as a dead tab. These tests pin the one thing that breaks
// the loop: a marker armed across the load, and a document that refuses to
// start one while it is still set.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { armLocalModelAttempt, disarmLocalModelAttempt, localModelKilledTheDocument, } from './local-model-crash-guard'

/** A sessionStorage that a test can inspect and make hostile. */
function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

function makeTarget() {
  const handlers = new Map<string, Set<EventListener>>()
  return {
    handlers,
    addEventListener: (type: string, fn: EventListener) => {
      const set = handlers.get(type) ?? new Set()
      set.add(fn)
      handlers.set(type, set)
    },
    removeEventListener: (type: string, fn: EventListener) => {
      handlers.get(type)?.delete(fn)
    },
    fire: (type: string) => {
      for (const fn of [...(handlers.get(type) ?? [])]) {
        fn(new Event(type))
      }
    },
  }
}

describe('local model crash guard', () => {
  let storage: ReturnType<typeof makeStorage>
  let target: ReturnType<typeof makeTarget>

  beforeEach(() => {
    storage = makeStorage()
    target = makeTarget()
    // Leave no marker armed from a previous case's window listener.
    disarmLocalModelAttempt({ storage, target })
  })

  it('reports a kill when a load was in flight and never settled', () => {
    armLocalModelAttempt({ storage, target })

    // The process dies here: no disarm, no pagehide. The next document asks.
    expect(localModelKilledTheDocument({ storage, target })).toBe(true)
  })

  it('reports nothing when the load settled, however it settled', () => {
    for (const _outcome of ['loaded', 'failed']) {
      armLocalModelAttempt({ storage, target })
      disarmLocalModelAttempt({ storage, target })
      expect(localModelKilledTheDocument({ storage, target })).toBe(false)
    }
  })

  it('answers yes exactly once, so Settings can offer a retry', () => {
    armLocalModelAttempt({ storage, target })

    expect(localModelKilledTheDocument({ storage, target })).toBe(true)
    expect(localModelKilledTheDocument({ storage, target })).toBe(false)
  })

  it('treats a deliberate navigation mid-load as survival, not a crash', () => {
    armLocalModelAttempt({ storage, target })

    // Tapping a room door while the model downloads fires pagehide. A
    // jetsammed process fires nothing, which is the whole discriminator.
    target.fire('pagehide')

    expect(localModelKilledTheDocument({ storage, target })).toBe(false)
  })

  it('stops listening for pagehide once the attempt has settled', () => {
    armLocalModelAttempt({ storage, target })
    disarmLocalModelAttempt({ storage, target })

    expect(target.handlers.get('pagehide')?.size ?? 0).toBe(0)
  })

  it('does not leave the previous attempt listening when a run restarts', () => {
    armLocalModelAttempt({ storage, target })
    armLocalModelAttempt({ storage, target })

    // One listener, not two: a stale one would clear the marker belonging to
    // a run that is still in flight.
    expect(target.handlers.get('pagehide')?.size ?? 0).toBe(1)
  })

  it('degrades to the old behaviour when storage refuses to write', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    }

    expect(() => {
      armLocalModelAttempt({ storage: hostile, target })
    }).not.toThrow()
    expect(localModelKilledTheDocument({ storage: hostile, target })).toBe(
      false,
    )
  })

  it('degrades to the old behaviour when storage refuses to read', () => {
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }

    expect(localModelKilledTheDocument({ storage: hostile, target })).toBe(
      false,
    )
  })

  it('never arms a listener it cannot back with a marker', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => undefined,
    }

    armLocalModelAttempt({ storage: hostile, target })

    expect(target.handlers.get('pagehide')?.size ?? 0).toBe(0)
  })

  it('writes a timestamp, so a stuck marker is diagnosable', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_757_500_000_000)

    armLocalModelAttempt({ storage, target })

    expect(storage.data.get('mercurypitch:voice-local-model-attempt')).toBe(
      '1757500000000',
    )
    vi.restoreAllMocks()
  })
})
