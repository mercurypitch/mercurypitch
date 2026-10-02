// ============================================================
// An iPad's navigator, for a copy test
// ============================================================
//
// iPadOS asks for desktop sites, so its web view reports a Mac with a touch
// screen no Mac has (device-noun.ts). A test that wants the iPad's wording
// makes the document's navigator say exactly that, and puts it back after.

import { vi } from 'vitest'

/** What an iPad's web view says it is: a Mac. */
export const IPADOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'

/**
 * Make the navigator an iPad's: a Mac's user agent with five touch points.
 * Returns the function that puts the real one back.
 */
export function actAsIpad(): () => void {
  const agent = vi
    .spyOn(navigator, 'userAgent', 'get')
    .mockReturnValue(IPADOS_USER_AGENT)
  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: 5,
    configurable: true,
  })
  return () => {
    agent.mockRestore()
    Reflect.deleteProperty(navigator, 'maxTouchPoints')
  }
}
