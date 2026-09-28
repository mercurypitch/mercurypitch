// ============================================================
// What the device in hand is called: a phone, an iPad or a tablet
// ============================================================
//
// Settings named every device "This phone", and on an iPad that sat over a
// row that read "iPad" (TestFlight 0.7.1). The noun is read here, on its
// own, so a screen that only needs the word does not pull in the device
// plugin and the alley that device-facts.ts reads its facts from.

/** What the device in hand is called in copy. */
export type DeviceNoun = 'phone' | 'iPad' | 'tablet'

/**
 * A phone, an iPad or a tablet, from the web view's own navigator.
 *
 * Settings said "This phone" on an iPad, over a row that read "iPad"
 * (TestFlight 0.7.1). Read synchronously, so a label is right on its first
 * frame rather than once the device plugin answers. iPadOS asks for desktop
 * sites, so its web view reports a Mac, with a touch screen no Mac has; an
 * Android tablet's leaves "Mobile" out. A Mac running the iPad app has no
 * touch screen and stays a phone: the one case this cannot tell.
 */
export function deviceNounFor(
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>,
): DeviceNoun {
  const agent = nav.userAgent
  if (/\biPad\b/u.test(agent)) return 'iPad'
  if (/\bMacintosh\b/u.test(agent) && nav.maxTouchPoints > 1) {
    return 'iPad'
  }
  if (/\bAndroid\b/u.test(agent) && !/\bMobile\b/u.test(agent)) {
    return 'tablet'
  }
  return 'phone'
}

/** "This phone", "This iPad" or "This tablet": the device in hand. */
export function thisDevice(): string {
  return `This ${deviceNounFor(navigator)}`
}
