// ── Jam diagnostics access tests ─────────────────────────────────────
// This decides whether a panel appears, from a URL somebody typed on a
// phone with one thumb. So the cases that matter are the malformed ones,
// the way back out, and a browser whose storage refuses to co-operate --
// because a throw here happens during boot, on the device least able to
// show you why.

import { describe, expect, it, vi } from 'vitest'
import { DIAGNOSTICS_STORAGE_KEY, readDiagnosticsParam, resolveDiagnosticsUnlock, } from '@/lib/jam/jam-diagnostics-access'

/** A localStorage stand-in that records what was asked of it. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    has: (k: string) => data.has(k),
  }
}

describe('readDiagnosticsParam', () => {
  it('turns on for the forms somebody would actually type', () => {
    expect(readDiagnosticsParam('?jamdiag=1')).toBe(true)
    expect(readDiagnosticsParam('?jamdiag=true')).toBe(true)
    expect(readDiagnosticsParam('?jamdiag=on')).toBe(true)
    // Bare, with no value: that is what typing it means.
    expect(readDiagnosticsParam('?jamdiag')).toBe(true)
    expect(readDiagnosticsParam('?jamdiag=')).toBe(true)
  })

  it('offers a way back out', () => {
    // Without this there is no exit short of clearing site data.
    expect(readDiagnosticsParam('?jamdiag=0')).toBe(false)
    expect(readDiagnosticsParam('?jamdiag=false')).toBe(false)
    expect(readDiagnosticsParam('?jamdiag=off')).toBe(false)
    expect(readDiagnosticsParam('?jamdiag=OFF')).toBe(false)
    expect(readDiagnosticsParam('?jamdiag= 0 ')).toBe(false)
  })

  it('says nothing when the URL says nothing', () => {
    // Null is a third answer, not a falsy one: it means "leave whatever
    // was remembered alone".
    expect(readDiagnosticsParam('')).toBeNull()
    expect(readDiagnosticsParam('?other=1')).toBeNull()
    expect(readDiagnosticsParam('?')).toBeNull()
  })

  it('finds the parameter alongside others, in any position', () => {
    expect(readDiagnosticsParam('?a=1&jamdiag=1&b=2')).toBe(true)
    expect(readDiagnosticsParam('a=1&jamdiag=0')).toBe(false)
  })
})

describe('resolveDiagnosticsUnlock', () => {
  it('remembers an unlock, so a reload keeps the panel', () => {
    // A two-device test is full of reloads. Re-typing the flag each time
    // is how a run ends up with a hole in the middle of it.
    const storage = fakeStorage()
    expect(resolveDiagnosticsUnlock('?jamdiag=1', storage)).toBe(true)
    expect(storage.has(DIAGNOSTICS_STORAGE_KEY)).toBe(true)
    expect(resolveDiagnosticsUnlock('', storage)).toBe(true)
  })

  it('forgets on the way out', () => {
    const storage = fakeStorage({ [DIAGNOSTICS_STORAGE_KEY]: '1' })
    expect(resolveDiagnosticsUnlock('?jamdiag=0', storage)).toBe(false)
    expect(storage.has(DIAGNOSTICS_STORAGE_KEY)).toBe(false)
    expect(resolveDiagnosticsUnlock('', storage)).toBe(false)
  })

  it('stays off by default', () => {
    expect(resolveDiagnosticsUnlock('', fakeStorage())).toBe(false)
  })

  it('ignores a stored value that is not the one we write', () => {
    const storage = fakeStorage({ [DIAGNOSTICS_STORAGE_KEY]: 'yes' })
    expect(resolveDiagnosticsUnlock('', storage)).toBe(false)
  })

  it('still honours the URL when storage refuses to write', () => {
    // A private window, or a phone with site data locked down. The flag
    // holds for this page load, which is enough to be useful.
    const hostile = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError')
      }),
      removeItem: vi.fn(),
    }
    expect(resolveDiagnosticsUnlock('?jamdiag=1', hostile)).toBe(true)
  })

  it('does not throw when storage refuses to read', () => {
    // This runs during boot, on the device least able to show you why it
    // failed.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    }
    expect(() => resolveDiagnosticsUnlock('', hostile)).not.toThrow()
    expect(resolveDiagnosticsUnlock('', hostile)).toBe(false)
  })

  it('works with no storage at all', () => {
    expect(resolveDiagnosticsUnlock('?jamdiag=1', null)).toBe(true)
    expect(resolveDiagnosticsUnlock('', null)).toBe(false)
  })
})
