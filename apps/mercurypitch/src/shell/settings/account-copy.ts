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

/**
 * The offer (S6 decision 02): a sheet once, after a take is kept in the Sing
 * room, and a card at the top of Settings until the singer says Later. Both
 * list ACCOUNT_PROMISES and end on TAKES_STAY_ON_PHONE.
 */
export const ACCOUNT_OFFER = {
  /** Over the sheet's title, when the take just kept is the phone's first. */
  firstTake: 'Your first take is kept',
  title: 'Take your practice with you',
  accept: 'Sign in',
  decline: 'Later',
} as const

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

/** The Delete account screen (5a): the loss named before anything happens. */
export const DELETE_ACCOUNT = {
  lead: 'Deleting cannot be undone. This is what happens.',
  goesTitle: 'What goes',
  goes: [
    'Your account, and each way of signing in to it',
    'The history and voiceprints kept in it',
    'Leaderboard entries and any unspent credits',
  ],
  /** Only for an account made with Sign in with Apple. */
  apple: {
    label: 'Sign in with Apple stops for MercuryPitch',
    sub: 'Apple is told to forget the link.',
  },
  staysTitle: 'What stays on this phone',
  stays: {
    label: 'Takes and practice kept here',
    sub: 'They stay, under a new identity for this phone.',
  },
  /** A way to delete it with no app (REQ-NAM-060). */
  elsewhere:
    'No app to hand? The same button is in Settings at mercurypitch.com, once you sign in.',
  button: 'Delete account',
} as const

/** The one question before deleting (5b, decision 03 A). */
export const DELETE_QUESTION = {
  title: 'Delete your account?',
  text: 'This cannot be undone. Your account and the history kept in it are erased.',
  confirm: 'Delete',
} as const

/** The line on Settings after a deletion (5d, REQ-NAM-059). */
export const ACCOUNT_DELETED =
  'Your account is deleted. Practice on this phone stays here.'

/**
 * Storage (6a, 6b): where each kind of record is kept, as the Storage screen
 * and its questions say it. Takes are never uploaded. Voiceprints go online
 * whenever the phone holds a session, an account's or the phone's own, so
 * only a phone that never held one can say a cleared voiceprint cannot come
 * back.
 */
export const STORAGE_COPY = {
  clearTakes:
    'They are only on this phone, so they cannot come back. Your history and voiceprints stay.',
  clearVoiceprints: {
    account:
      'The copies on this phone go. Your account keeps the ones it holds.',
    online:
      'The copies on this phone go. Copies saved online with your history stay.',
    phoneOnly:
      'They are only on this phone, so they cannot come back. Your history and takes stay.',
  },
} as const

/** The Takes row's line: "23 takes, only on this phone". */
export function takesLine(count: number): string {
  return `${count} ${count === 1 ? 'take' : 'takes'}, only on this phone`
}
