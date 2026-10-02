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
//
// The app runs on an iPad and an Android tablet too, so a line that names
// the device in hand reads it when it is shown (device-noun.ts): "this
// phone" on a phone, "this iPad" on an iPad. The objects keep their shape;
// those lines are getters, and the bare lines are functions.

import { deviceNoun, thisDevice, thisDeviceLower } from '@/lib/device-noun'

/** What an account adds: the offer and the Account screen both list these. */
export function accountPromises(): readonly string[] {
  const here = thisDeviceLower()
  return [
    `Your whole history, not only what ${here} keeps`,
    `On your next ${deviceNoun()}, and on the web`,
    `Still yours if ${here} is lost`,
  ]
}

/**
 * The line under the sign-in sheet's title. It says the account is reachable
 * from the next phone and from the web, so it is a promise like the three
 * above and lives with them.
 */
export function signInEverywhere(): string {
  return `Use the same way on ${thisDeviceLower()}, your next one and the web.`
}

/** The title over the promises on the Account screen. */
export const ACCOUNT_ADDS_TITLE = 'An account adds'

/** What stays on the device either way. Said wherever the promises are. */
export function takesStayHere(): string {
  return `Takes stay on ${thisDeviceLower()}.`
}

/**
 * The offer (S6 decision 02): a sheet once, after a take is kept in the Sing
 * room, and a card at the top of Settings until the singer says Later. Both
 * list accountPromises() and end on takesStayHere().
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
  get signedOutSub(): string {
    return `Practicing on ${thisDeviceLower()} only`
  },
  signedOutValue: 'Sign in',
} as const

/** The card on the Account screen with no account on the phone. */
export const ACCOUNT_SIGNED_OUT = {
  title: 'No account yet',
  get body(): string {
    return `Everything you practice is kept on ${thisDeviceLower()}.`
  },
} as const

/** The note over the card when the account cannot be reached (REQ-NAM-049). */
export const ACCOUNT_OFFLINE = {
  title: 'Could not reach your account just now.',
  get body(): string {
    return `You are still signed in on ${thisDeviceLower()}; your practice here is safe.`
  },
} as const

/**
 * The card after this phone signed out of an account (REQ-NAM-054): the
 * account's history is not shown, not gone, and the phone's practice stays.
 */
export const ACCOUNT_SIGNED_OUT_HERE = {
  title: 'Signed out',
  get body(): string {
    return `Your account's history shows again when you sign in. Everything you practice is kept on ${thisDeviceLower()}.`
  },
} as const

/** The one question before signing out (4f, REQ-NAM-054). */
export const SIGN_OUT_QUESTION = {
  title: 'Sign out?',
  get text(): string {
    return `Your practice stays on ${thisDeviceLower()}. Sign in again any time to see your account's history.`
  },
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
  get offSub(): string {
    return `Turn it on from the web. ${thisDevice()} asks for the code.`
  },
  get onSub(): string {
    return `Change it from the web. ${thisDevice()} asks for the code.`
  },
} as const

/**
 * The one-time note after signing in to an account that already existed
 * (4b, REQ-NAM-043 to 045). It says the account's history reached this
 * phone, and what did not: takes stay on the phone that kept them.
 */
export const FILL_NOTE = {
  get lead(): string {
    return `Your account's history is on ${thisDeviceLower()} now:`
  },
  get takes(): string {
    return `Takes stay on the ${deviceNoun()} that kept them.`
  },
  failedTitle: "Could not load your account's history just now.",
  get failedBody(): string {
    return `What ${thisDeviceLower()} kept is still here.`
  },
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
  get staysTitle(): string {
    return `What stays on ${thisDeviceLower()}`
  },
  stays: {
    label: 'Takes and practice kept here',
    get sub(): string {
      return `They stay, under a new identity for ${thisDeviceLower()}.`
    },
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
export function accountDeleted(): string {
  return `Your account is deleted. Practice on ${thisDeviceLower()} stays here.`
}

/**
 * Storage (6a, 6b): where each kind of record is kept, as the Storage screen
 * and its questions say it. Takes are never uploaded. Voiceprints go online
 * whenever the phone holds a session, an account's or the phone's own, so
 * only a phone that never held one can say a cleared voiceprint cannot come
 * back.
 */
export const STORAGE_COPY = {
  get clearTakes(): string {
    return `They are only on ${thisDeviceLower()}, so they cannot come back. Your history and voiceprints stay.`
  },
  clearVoiceprints: {
    get account(): string {
      return `The copies on ${thisDeviceLower()} go. Your account keeps the ones it holds.`
    },
    get online(): string {
      return `The copies on ${thisDeviceLower()} go. Copies saved online with your history stay.`
    },
    get phoneOnly(): string {
      return `They are only on ${thisDeviceLower()}, so they cannot come back. Your history and takes stay.`
    },
  },
} as const

/** The Takes row's line: "23 takes, only on this phone" (or this iPad). */
export function takesLine(count: number): string {
  return `${count} ${count === 1 ? 'take' : 'takes'}, only on ${thisDeviceLower()}`
}
