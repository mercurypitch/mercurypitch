// ============================================================
// What the device in hand is called: a phone, an iPad or a tablet
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { deviceNoun, deviceNounFor, theDevice, thisDevice, thisDeviceLower, thisDevicePossessive, yourDevice, yourDevicePossessive, } from './device-noun'

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

describe('the phrases copy builds from it', () => {
  let restore: (() => void) | null = null
  afterEach(() => {
    restore?.()
    restore = null
  })

  it('says "phone" in every form on a phone', () => {
    expect(deviceNoun()).toBe('phone')
    expect([
      thisDevice(),
      thisDeviceLower(),
      thisDevicePossessive(),
      yourDevice(),
      yourDevicePossessive(),
      theDevice(),
    ]).toEqual([
      'This phone',
      'this phone',
      "this phone's",
      'your phone',
      "Your phone's",
      'the phone',
    ])
  })

  it('names an iPad in every form, read from the navigator each time', () => {
    restore = actAsIpad()
    expect(deviceNoun()).toBe('iPad')
    expect([
      thisDevice(),
      thisDeviceLower(),
      thisDevicePossessive(),
      yourDevice(),
      yourDevicePossessive(),
      theDevice(),
    ]).toEqual([
      'This iPad',
      'this iPad',
      "this iPad's",
      'your iPad',
      "Your iPad's",
      'the iPad',
    ])
  })
})
