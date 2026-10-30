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

import { GIFT_ARRIVES, giftCount } from '@/lib/launch-gift-copy'

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

/**
 * In place of the auto-start line once nothing has been heard for a while:
 * the usual cause, which the microphone list under the stage then answers.
 */
export const FIRST_LIGHT_NUDGE =
  "Still nothing. If you're singing, the browser is probably listening to a different microphone."

/** The fixes under "Mic not behaving?", in the order worth trying them. */
export const FIRST_LIGHT_FIX_PICK =
  "Tap the microphone's name above to switch to the one you're singing into."
export const FIRST_LIGHT_FIX_MUTED =
  "Check it isn't muted: a switch on the mic or headset, your system's sound settings, or the gain on an audio interface."
export const FIRST_LIGHT_FIX_APPS =
  'Close anything that may be holding the microphone: meeting, recording or streaming apps, and any other MercuryPitch tab.'

/** Under the fixes: what a browser cannot see. */
export const FIRST_LIGHT_FIX_LIMIT =
  "Your browser can't see other apps, so it can't say when one of them has the microphone."

/** Beside an input that opened and sent nothing at all. */
export const FIRST_LIGHT_SILENT_PICK =
  'No sound came from this one, not even room noise. Try another.'

/** When the input picked would not open. */
export const FIRST_LIGHT_PICK_FAILED =
  "That input would not open. Pick another, or check that it's connected."

/** Over the screen when the input opened carries nothing at all: there is a
 *  microphone, so not "No microphone". */
export const FIRST_LIGHT_DEAD_EYEBROW = 'No signal'

/** Why, under that eyebrow. "Room noise", as on a silent pick's row. */
export const FIRST_LIGHT_DEAD_INPUT =
  "That input is sending nothing, not even room noise. It's likely muted at the system level, or your browser is listening to a different microphone."

/** The eyebrow over the note Merc heard. */
export const FIRST_LIGHT_HEARD_EYEBROW = 'Merc heard you'

/** Under the note Merc heard, as the star lights. */
export const FIRST_LIGHT_HEARD =
  "Your note lit the first star. Now let's find the rest of your range."

/**
 * The twin's one line about what comes next once the plan is answered or
 * turned down, so the Map is the next stop after the account ask. "A room",
 * not "rooms": the Map picks one first stop from the voiceprint
 * (first-stop.ts). Short enough for two lines on a 320 px phone (the owner
 * asked for one or two; the longer line, which ended "from daily practice
 * to Karaoke Night", took three).
 */
export const TWIN_NEXT = 'Next, the Map: a room picked for your voice.'

/**
 * The same line while the person's plan is due: the four questions come
 * before the Map. A few characters longer than TWIN_NEXT, still two lines
 * on a 320 px phone.
 */
export const TWIN_NEXT_PLAN = 'Next, your plan: four taps, then where to start.'

/**
 * The Prints button's label: where it leads is the four questions while
 * the plan is due, and the Map once it is answered or turned down.
 */
export const PRINTS_NEXT_PLAN = 'Make my plan'
export const PRINTS_NEXT_MAP = 'See my map'

// The gift's own words are shared with the Voice Mirror's account ask, so
// they live in src/lib/launch-gift-copy.ts; re-exported here so the beats
// keep importing every line from this one file.
export { GIFT_BODY, giftTitle } from '@/lib/launch-gift-copy'

/** The Map, for an account whose gift is waiting to be claimed. */
export function mapGiftWaiting(credits: number): string {
  return `Your launch gift is waiting: ${giftCount(credits)}.`
}

/** The Map, for a visitor with nothing to keep and no account yet. */
export function mapGiftJoin(credits: number): string {
  return `Launch gift: ${giftCount(credits)} with a free account.`
}

/** The link after the Map's join line. */
export const MAP_GIFT_JOIN_LINK = 'Get my gift'

/** The tag on the Karaoke card while the gift is on offer. */
export const KARAOKE_GIFT_TAG = 'Launch gift'

/** The Map's way back to Keep, while the gift is on offer. */
export const MAP_KEEP_GIFT_LINK = 'Save it and get the launch gift'

/** Under Keep's button while the gift is on offer: when it lands. */
export const KEEP_GIFT_CAPTION = GIFT_ARRIVES
