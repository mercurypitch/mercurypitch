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

/**
 * The card after this phone signed out of an account (REQ-NAM-054): the
 * account's history is not shown, not gone, and the phone's practice stays.
 */
export const ACCOUNT_SIGNED_OUT_HERE = {
  title: 'Signed out',
  body: "Your account's history shows again when you sign in. Everything you practice is kept on this phone.",
} as const

/** The one question before signing out (4f, REQ-NAM-054). */
export const SIGN_OUT_QUESTION = {
  title: 'Sign out?',
  text: "Your practice stays on this phone. Sign in again any time to see your account's history.",
  confirm: 'Sign out',
} as const

/**
 * Under a private Apple relay address. The web's words, verbatim: it is the
 * only way into the account where there is no Apple sheet.
 */
export const RELAY_NOTE =
  'Your private Apple address. Keep a note of it: it signs you in with an email code on the web or Android.'

/**
 * Two-step sign-in as a state (S6 decision 04 A): it is set up on the web,
 * and a sign-in on this phone asks for the code whenever it is on.
 */
export const TWO_STEP = {
  label: 'Two-step sign-in',
  offSub: 'Turn it on from the web. This phone asks for the code.',
  onSub: 'Change it from the web. This phone asks for the code.',
} as const

/**
 * The one-time note after signing in to an account that already existed
 * (4b, REQ-NAM-043 to 045). It says the account's history reached this
 * phone, and what did not: takes stay on the phone that kept them.
 */
export const FILL_NOTE = {
  lead: "Your account's history is on this phone now:",
  takes: 'Takes stay on the phone that kept them.',
  failedTitle: "Could not load your account's history just now.",
  failedBody: 'What this phone kept is still here.',
} as const

/** "38 runs and 2 voiceprints.", the counts after FILL_NOTE.lead. */
export function fillLine(runs: number, voiceprints: number): string {
  if (runs === 0 && voiceprints === 0) return 'no runs or voiceprints yet.'
  const count = (n: number, one: string, many: string): string =>
    `${n} ${n === 1 ? one : many}`
  return `${count(runs, 'run', 'runs')} and ${count(voiceprints, 'voiceprint', 'voiceprints')}.`
}
