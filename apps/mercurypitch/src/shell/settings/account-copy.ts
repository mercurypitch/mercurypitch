// ============================================================
// Account copy — every line that says what an account keeps
// ============================================================
//
// One module, and no second copy of any of these anywhere else: the lines
// that promise what an account syncs or backs up, and the lines that say
// what stays on the phone without one. Which of the promises come free and
// which come with a subscription is not decided yet ("your history on your
// next phone and on the web" may be a paid benefit), so they live where one
// edit changes every screen that shows them, and the tests read them from
// here rather than spelling them out again.
//
// Nothing here says "free", "paid" or a price. A claim like that belongs in
// this file too, the day there is one to make.

/** What an account adds: the offer and the Account screen both list these. */
export const ACCOUNT_PROMISES = [
  'Your whole history, not only what this phone keeps',
  'On your next phone, and on the web',
  'Still yours if this phone is lost',
] as const

/**
 * The line under the sign-in sheet's title. It says the account is reachable
 * from the next phone and from the web, so it is a promise like the three
 * above and lives with them.
 */
export const SIGN_IN_EVERYWHERE =
  'Use the same way on this phone, your next one and the web.'

/** The title over the promises on the Account screen. */
export const ACCOUNT_ADDS_TITLE = 'An account adds'

/** What stays on the phone either way. Said wherever the promises are. */
export const TAKES_STAY_ON_PHONE = 'Takes stay on this phone.'

/** The Account row in Settings. */
export const ACCOUNT_ROW = {
  label: 'Account',
  signedOutSub: 'Practicing on this phone only',
  signedOutValue: 'Sign in',
} as const

/** The card on the Account screen with no account on the phone. */
export const ACCOUNT_SIGNED_OUT = {
  title: 'No account yet',
  body: 'Everything you practice is kept on this phone.',
} as const

/** The note over the card when the account cannot be reached (REQ-NAM-049). */
export const ACCOUNT_OFFLINE = {
  title: 'Could not reach your account just now.',
  body: 'You are still signed in on this phone; your practice here is safe.',
} as const
