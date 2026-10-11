// ============================================================
// Mirror subdomain: where a mirror.* address goes on the apex
// ============================================================
//
// The owner's call (11 Oct 2026): mirror.mercurypitch.com redirects to
// mercurypitch.com/mirror, so every Mirror visitor gets the same page and
// the account offer. The worker and the Mirror's entry share this mapping.

import { describe, expect, it, vi } from 'vitest'
import { apexMirrorUrl, leaveMirrorSubdomain } from './mirror-subdomain'

describe('the apex address of a mirror.* page', () => {
  it('sends the root to /mirror', () => {
    expect(apexMirrorUrl('https://mirror.mercurypitch.com/')).toBe(
      'https://mercurypitch.com/mirror',
    )
  })

  it('keeps a share link whole: path, every query value and the hash', () => {
    expect(
      apexMirrorUrl(
        'https://mirror.mercurypitch.com/?v=abc&og=x&utm_source=ad&gclid=G1#take-2',
      ),
    ).toBe(
      'https://mercurypitch.com/mirror?v=abc&og=x&utm_source=ad&gclid=G1#take-2',
    )
  })

  it('keeps any other path as it is', () => {
    expect(
      apexMirrorUrl('https://mirror.mercurypitch.com/vocal-range-test?x=1'),
    ).toBe('https://mercurypitch.com/vocal-range-test?x=1')
    expect(apexMirrorUrl('https://mirror.mercurypitch.com/free-sing')).toBe(
      'https://mercurypitch.com/free-sing',
    )
  })

  it("stays in the address's own environment", () => {
    expect(apexMirrorUrl('http://mirror.localhost:8787/')).toBe(
      'http://localhost:8787/mirror',
    )
  })

  it('leaves every other host alone', () => {
    expect(apexMirrorUrl('https://mercurypitch.com/')).toBeNull()
    expect(apexMirrorUrl('https://mercurypitch.com/mirror')).toBeNull()
    expect(apexMirrorUrl('https://dev.mercurypitch.com/mirror')).toBeNull()
  })
})

describe('leaving the subdomain in the browser', () => {
  it('replaces the address with the apex one and says it left', () => {
    const replace = vi.fn()

    const left = leaveMirrorSubdomain({
      href: 'https://mirror.mercurypitch.com/voice-type-test?utm_source=x#take-1',
      replace,
    })

    expect(left).toBe(true)
    expect(replace).toHaveBeenCalledWith(
      'https://mercurypitch.com/voice-type-test?utm_source=x#take-1',
    )
  })

  it('stays put on the apex', () => {
    const replace = vi.fn()

    const left = leaveMirrorSubdomain({
      href: 'https://mercurypitch.com/mirror',
      replace,
    })

    expect(left).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })
})
