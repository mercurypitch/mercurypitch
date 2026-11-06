// Studio persistence — the readout follows the browser's answer, a browser without the call or one that fails says "unknown", and the request goes once a page.
import { describe, expect, it, vi } from 'vitest'
import { studioProtectionText } from './storage-copy'
import type { StudioPersistenceDependencies } from './studio-persistence'
import { createStudioPersistence } from './studio-persistence'

function browser(
  kept: () => Promise<boolean | null>,
  granted = true,
): StudioPersistenceDependencies {
  return { ensure: vi.fn(async () => granted), persisted: vi.fn(kept) }
}

describe('Studio persistence', () => {
  it('says the songs may be cleared until the browser keeps them, then that they are kept', async () => {
    let kept = false
    const deps = browser(async () => kept)
    const persistence = createStudioPersistence(deps)
    await vi.waitFor(() => expect(persistence.protection()).toBe('unprotected'))

    kept = true
    persistence.afterKeep()
    persistence.afterKeep()

    await vi.waitFor(() => expect(persistence.protection()).toBe('protected'))
    expect(deps.ensure).toHaveBeenCalledOnce()
    expect(studioProtectionText('protected')).toContain('keeps your songs')
  })

  it('says it cannot tell where the browser has no call, or the call fails', async () => {
    const missing = createStudioPersistence(browser(async () => null))
    const failing = createStudioPersistence(
      browser(async () => {
        throw new Error('blocked')
      }),
    )

    await vi.waitFor(() => {
      expect(missing.protection()).toBe('unknown')
      expect(failing.protection()).toBe('unknown')
    })
    expect(studioProtectionText('unknown')).toContain('Save a project backup')
  })

  it('reads the answer back after a refusal too', async () => {
    const deps = browser(async () => false, false)
    const persistence = createStudioPersistence(deps)

    persistence.afterKeep()

    await vi.waitFor(() => expect(deps.persisted).toHaveBeenCalledTimes(2))
    expect(persistence.protection()).toBe('unprotected')
  })
})
