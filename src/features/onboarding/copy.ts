// ============================================================
// First Light — the lines the owner may swap, one place each
// ============================================================
//
// The listening lines of the first note, the twin's next step and the
// launch gift's wording, written for the owner's phone test of 11 Oct 2026.
// The owner may swap any of them later, so each one lives here once and
// the beats and their tests import it: a swap is a one-line change.
//
// What every line must keep is pinned in src/tests/onboarding-copy.test.tsx
// (FVC-*): Merc is the one listening on the first note, never "we"; no em
// dash; and the privacy line says where the sound stays, never what is not
// uploaded (the owner's standing rule).

/** First light, before the microphone: who is listening. */
export const FIRST_LIGHT_HEADLINE = 'Merc is all ears'

/** First light, the ask, when the browser will still ask for the mic. */
export const FIRST_LIGHT_ASK =
  'Hold any note for a few seconds. When your browser asks for the microphone, choose Allow.'

/** First light, the ask, when the microphone is already allowed. */
export const FIRST_LIGHT_ASK_ALLOWED =
  'Your microphone is already allowed. Hold any note for a few seconds.'

/**
 * Said under both asks. True of the whole flow: the microphone feeds a
 * pitch detector on this device, and only numbers (range, steadiness,
 * accuracy) are ever saved or shared, never sound (voice-session.ts,
 * voiceprint-service.ts).
 */
export const FIRST_LIGHT_PRIVACY =
  'Merc listens, and the sound stays on this device.'

/** First light, waiting for a voice, while the take starts by itself. */
export const FIRST_LIGHT_AUTO_START =
  'Any note at all, held for a few seconds. Recording starts by itself the moment Merc hears you.'

/** The meter's caption once the level reads as a voice. */
export const FIRST_LIGHT_METER_LIVE = 'Merc can hear you'

/** The eyebrow over the note Merc heard. */
export const FIRST_LIGHT_HEARD_EYEBROW = 'Merc heard you'

/** Under the note Merc heard, as the star lights. */
export const FIRST_LIGHT_HEARD =
  "Your note lit the first star. Now let's find the rest of your range."

/**
 * The twin's one line about what comes next. "A room", not "rooms": the
 * Map picks one first stop from the voiceprint (first-stop.ts), and its
 * picks run from a drill to Karaoke Night; Practice holds Daily Practice.
 */
export const TWIN_NEXT =
  'Next, the Map: a room picked for your voice, from daily practice to Karaoke Night.'

/**
 * The launch gift, named by what it buys. A credit splits one song of up to
 * 12 minutes into voice and band on the Cloud GPU; a longer song or a full
 * band split costs more (billing-core `uvrJobCost`), so the count is "up
 * to". The number is always the server's (promo-store).
 */
export function giftTitle(credits: number): string {
  return `Up to ${credits} free song separations`
}

/** Why the gift is worth having: Karaoke Night scores every note sung. */
export const GIFT_BODY =
  'Sing your favorite songs at Karaoke Night and see how you score.'

/** The Map, for an account whose gift is waiting to be claimed. */
export function mapGiftWaiting(credits: number): string {
  return `Your launch gift is waiting: up to ${credits} free song separations.`
}

/** The Map, for a visitor with nothing to keep and no account yet. */
export function mapGiftJoin(credits: number): string {
  return `Launch gift: up to ${credits} free song separations with a free account.`
}

/** The link after the Map's join line. */
export const MAP_GIFT_JOIN_LINK = 'Get my gift'

/** The tag on the Karaoke card while the gift is on offer. */
export const KARAOKE_GIFT_TAG = 'Launch gift'

/** The Map's way back to Keep, while the gift is on offer. */
export const MAP_KEEP_GIFT_LINK = 'Save it and get the launch gift'
