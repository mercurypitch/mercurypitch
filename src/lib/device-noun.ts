// ============================================================
// What the device in hand is called: a phone, an iPad or a tablet
// ============================================================
//
// Settings named every device "This phone", and on an iPad that sat over a
// row that read "iPad" (TestFlight 0.7.1). The noun is read here, on its
// own, so a screen that only needs the word does not pull in the device
// plugin and the alley that device-facts.ts reads its facts from.
//
// It lives in the shared `src/lib` rather than beside the native shell's
// Settings because the rooms the shell hosts (Karaoke's import and library,
// Sing's take sheet, the stem mixer) say "this phone" too, and they cannot
// import from `apps/mercurypitch`. One detection, every sentence.

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

/**
 * The device in hand, read on every call: a copy line built from it is
 * right wherever it is first shown, and a test can change the navigator
 * under it. "phone" with no navigator at all, as before there was a choice.
 */
export function deviceNoun(): DeviceNoun {
  return typeof navigator === 'undefined' ? 'phone' : deviceNounFor(navigator)
}

/** "This phone", "This iPad" or "This tablet": a sentence's first words. */
export function thisDevice(): string {
  return `This ${deviceNoun()}`
}

/** "this phone", "this iPad" or "this tablet", inside a sentence. */
export function thisDeviceLower(): string {
  return `this ${deviceNoun()}`
}

/** "this phone's", "this iPad's" or "this tablet's". */
export function thisDevicePossessive(): string {
  return `this ${deviceNoun()}'s`
}

/** "your phone", "your iPad" or "your tablet", inside a sentence. */
export function yourDevice(): string {
  return `your ${deviceNoun()}`
}

/** "Your phone's", "Your iPad's" or "Your tablet's": a sentence's first words. */
export function yourDevicePossessive(): string {
  return `Your ${deviceNoun()}'s`
}

/** "the phone", "the iPad" or "the tablet", inside a sentence. */
export function theDevice(): string {
  return `the ${deviceNoun()}`
}
