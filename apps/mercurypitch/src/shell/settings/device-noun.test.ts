// ============================================================
// What the device in hand is called: a phone, an iPad or a tablet
// ============================================================

import { describe, expect, it } from 'vitest'
import { deviceNounFor } from './device-noun'

describe('what the device is called', () => {
  // Settings said "This phone" on an iPad, over a row that read "iPad"
  // (TestFlight 0.7.1). The web view's own navigator says which it is.
  const IPADOS =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
  const IOS_PHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

  it('calls an iPad an iPad, though iPadOS reports a Mac with a touch screen', () => {
    expect(deviceNounFor({ userAgent: IPADOS, maxTouchPoints: 5 })).toBe('iPad')
  })

  it('calls an iPad that says so in its user agent an iPad', () => {
    expect(
      deviceNounFor({
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
      }),
    ).toBe('iPad')
  })

  it('calls an iPhone a phone', () => {
    expect(deviceNounFor({ userAgent: IOS_PHONE, maxTouchPoints: 5 })).toBe(
      'phone',
    )
  })

  it('calls an Android tablet a tablet, and an Android phone a phone', () => {
    const android = 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36'
    expect(
      deviceNounFor({
        userAgent: `${android} (KHTML, like Gecko) Chrome/140.0 Safari/537.36`,
        maxTouchPoints: 10,
      }),
    ).toBe('tablet')
    expect(
      deviceNounFor({
        userAgent: `${android} (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36`,
        maxTouchPoints: 10,
      }),
    ).toBe('phone')
  })

  it('keeps "phone" for a Mac with no touch screen, the one case it cannot tell', () => {
    expect(deviceNounFor({ userAgent: IPADOS, maxTouchPoints: 0 })).toBe(
      'phone',
    )
  })
})
