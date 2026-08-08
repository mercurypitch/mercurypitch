// ============================================================
// shareCard outcomes — dismissal is not delivery
// ============================================================
//
// The Web Share sheet being closed without sending used to fall through to
// the download branch: the user got a file they never asked for, and every
// call site counted it as `card_shared` — a LIVE Ads conversion. These pin
// the outcome contract the call sites now gate on.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareCard } from './card-renderer'

const blob = new Blob(['x'], { type: 'image/png' })

function mockShare(share: (() => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'canShare', {
    value: share === undefined ? undefined : () => true,
    configurable: true,
  })
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
  })
}

afterEach(() => {
  mockShare(undefined)
  vi.restoreAllMocks()
})

describe('shareCard', () => {
  it('reports a completed native share', async () => {
    mockShare(() => Promise.resolve())
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('shared')
    expect(click).not.toHaveBeenCalled()
  })

  it('reports a closed sheet as dismissed, with NO forced download', async () => {
    mockShare(() =>
      Promise.reject(new DOMException('user cancelled', 'AbortError')),
    )
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('dismissed')
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to a download when the share API rejects the data', async () => {
    mockShare(() => Promise.reject(new DOMException('nope', 'NotAllowedError')))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('downloads directly where the share API does not exist', async () => {
    mockShare(undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    expect(await shareCard(blob)).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })
})
