// ============================================================
// The Karaoke room's songs: what is left, and how it is said (plan S8 §6.7)
// ============================================================
//
// The singer sees songs, never credits. Under the hood a song up to twelve
// minutes is one credit in the ledger, and the Mercury Pitch Cloud
// subscription grants a number of them each month into it (db-worker
// revenuecat.ts). "Songs left" is what `/api/billing/me` says the app can
// spend: the subscription's songs and a signed-in singer's free song of the
// month, never credits bought on the web (owner, S7 D9 and D5; the server
// decides, db-worker app-songs.ts). The balance is never read as songs
// here, so a worker that does not say `songs` leaves them unknown.
//
// Nothing here buys anything. The paywall is KaraokeImport's, and its
// Subscribe goes through the shell (nativeShellApi().karaokeSubscription).

import { createSignal } from 'solid-js'
import { fetchBillingMe } from '@/db/services/billing-service'
import { ensureSingerIdentity } from '@/db/services/singer-identity'
import { thisDeviceLower } from '@/lib/device-noun'
import type { KaraokeRestoreOutcome } from '@/stores/native-shell-store'

/**
 * The songs a month the subscription grants, until the server says (owner,
 * 27 Sep: 20). The server's `perPeriod` wins wherever it is known. The price
 * is never ours to state: the paywall shows the store's own.
 */
export const KARAOKE_PLAN = Object.freeze({
  songsPerMonth: 20,
  /** The most unused songs carry over to (owner, S7 D4: 50). */
  carryOverCap: 50,
})

/** The subscription's name, in the stores and in the app (owner, S7 D2). */
export const CLOUD_NAME = 'Mercury Pitch Cloud'

/**
 * The days a separated song waits on the server for this phone to collect
 * it. The stems' R2 bucket expires them one day after they are written
 * (docs/claude/RUNPOD.md, "Stem storage lifecycle": `--expire-days 1` on the
 * `runpod/` and `runpod-dev/` prefixes), so the confirm sheet asks for about
 * a day and promises no more (owner, 28 Sep).
 */
export const STEMS_KEPT_DAYS = 1

/** When to open the app again for a song, within what the stems are kept. */
export function collectLine(count: number): string {
  const within =
    STEMS_KEPT_DAYS === 1 ? 'about a day' : `about ${STEMS_KEPT_DAYS} days`
  return `Open Mercury Pitch within ${within} to save ${count === 1 ? 'it' : 'them'} to ${thisDeviceLower()}.`
}

export interface KaraokeSongs {
  /** Songs that can still be separated, or null until the server has said. */
  readonly left: number | null
  /** A Karaoke subscription that has not ended. */
  readonly subscribed: boolean
  /** When the next songs arrive, while subscribed. */
  readonly renewsAt: string | null
  /** Songs a month grants. */
  readonly perPeriod: number
  /** The most songs carried over; absent until the server has said. */
  readonly cap?: number
  /** The month's free song among those left, 1 or 0, for a signed-in
   *  singer (owner, S7 D5); absent where the server does not say. */
  readonly free?: number
  /** Whether the server gives this singer a free song each month at all,
   *  spent or not (db-worker getsFreeSong); absent where it does not say. */
  readonly monthly?: boolean
}

const UNKNOWN: KaraokeSongs = Object.freeze({
  left: null,
  subscribed: false,
  renewsAt: null,
  perPeriod: KARAOKE_PLAN.songsPerMonth,
})

const [songs, setSongs] = createSignal<KaraokeSongs>(UNKNOWN)

/** What is known of the songs, as a signal. */
export const karaokeSongs = songs

/**
 * Ask the server again. `identify` first gives this phone the identity a
 * separation needs (anonymous until the singer signs in), which is right at
 * the moment of an import and too eager on the way into the room. What is
 * known stands when the server does not answer.
 */
export async function refreshKaraokeSongs(
  options: { identify?: boolean } = {},
): Promise<KaraokeSongs> {
  if (options.identify === true) await ensureSingerIdentity()
  const me = await fetchBillingMe()
  if (me === null) return songs()
  const next: KaraokeSongs =
    me.songs === undefined
      ? UNKNOWN
      : {
          left: me.songs.left,
          subscribed: me.songs.subscribed,
          renewsAt: me.songs.renewsAt,
          perPeriod: me.songs.perPeriod,
          cap: me.songs.cap,
          ...(me.songs.free === undefined ? {} : { free: me.songs.free }),
          ...(me.songs.monthly === undefined
            ? {}
            : { monthly: me.songs.monthly }),
        }
  setSongs(next)
  return next
}

const [onTheWay, setOnTheWay] = createSignal(false)

/**
 * The store has said yes to a purchase or a restore, and the server has not
 * heard yet: it hears from RevenueCat's webhook, usually within seconds.
 * Meanwhile the room says the songs are on their way rather than showing
 * the paywall again.
 */
export const songsOnTheWay = onTheWay

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Ask the server again until it says subscribed, a few times, and settle
 * for what it last said. `refresh` is how to ask (refreshKaraokeSongs).
 */
export async function awaitSubscription(
  refresh: () => Promise<KaraokeSongs>,
  options: {
    tries?: number
    everyMs?: number
    wait?: (ms: number) => Promise<void>
  } = {},
): Promise<KaraokeSongs> {
  const { tries = 10, everyMs = 3_000, wait = sleep } = options
  setOnTheWay(true)
  try {
    let heard = await refresh()
    for (let asked = 1; asked < tries && !heard.subscribed; asked += 1) {
      await wait(everyMs)
      heard = await refresh()
    }
    return heard
  } finally {
    setOnTheWay(false)
  }
}

export function resetKaraokeSongsForTests(next: KaraokeSongs = UNKNOWN): void {
  setSongs(next)
}

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? one : many

/** Within this month's grant, where "18 of 20" reads true. */
function withinMonth(state: KaraokeSongs): state is KaraokeSongs & {
  left: number
} {
  return (
    state.subscribed && state.left !== null && state.left <= state.perPeriod
  )
}

/**
 * The chip on the import row (S7b §4.3), where Import goes straight to
 * Files: "14 of 20 songs left" within a subscriber's month, "Your free song
 * this month" for a signed-in singer's one, and the plain count otherwise
 * (songs carried over, review access). Null where Import opens the offer or
 * the note instead, and while nothing is known.
 */
export function importChip(state: KaraokeSongs): string | null {
  const left = state.left
  if (left === null || left === 0) return null
  if (withinMonth(state)) return `${left} of ${state.perPeriod} songs left`
  if (!state.subscribed && state.free === 1 && left === 1) {
    return 'Your free song this month'
  }
  return `${left} ${plural(left, 'song', 'songs')} left`
}

/** The line under Import a song (mock 4b, 4c); the songs left are its chip. */
export function importLine(state: KaraokeSongs): string {
  if (state.left === 0 && !state.subscribed) {
    return `Any song from Files. Our server separates the voice from the music, and the song then lives on ${thisDeviceLower()}. Part of the subscription.`
  }
  return 'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes.'
}

/** The Options row: its label and its value, or null while nothing is known. */
export function songsOptionRow(
  state: KaraokeSongs,
): { label: string; value: string } | null {
  if (state.left === null) return null
  if (withinMonth(state)) {
    return {
      label: 'Songs this month',
      value: `${state.left} of ${state.perPeriod} left`,
    }
  }
  return {
    label: 'Songs',
    value: state.left === 0 ? 'None left' : `${state.left} left`,
  }
}

/** The confirm sheet's cost line for `count` songs (plan §6.2). */
export function confirmCostLine(state: KaraokeSongs, count: number): string {
  const after = state.left === null ? null : Math.max(0, state.left - count)
  if (withinMonth(state) && after !== null) {
    return `Uses ${count} of your ${state.perPeriod} songs this month. ${after} left after this.`
  }
  const uses = `Uses ${count} of your songs.`
  return after === null ? uses : `${uses} ${after} left after this.`
}

/** "27 October", in the words the sheets use. */
export function formatRenewal(iso: string | null): string | null {
  if (iso === null) return null
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

/**
 * What a subscriber with none left is told instead of the offer (S7b
 * §4.3): the month is used, and when the next songs come. "Used" rather
 * than the plan's "sung all 20": an imported song counts whether or not it
 * was sung, and songs carried over make the month more than 20.
 */
export function noSongsLeftLine(state: KaraokeSongs): string {
  const on = formatRenewal(state.renewsAt)
  const more = `${state.perPeriod} more`
  return `You've used all your songs this month. ${on === null ? `${more} next month.` : `${more} on ${on}.`}`
}

/**
 * When a signed-in singer's next free song comes: the 1st of next month.
 * The server counts the month in UTC (songMonth, db-worker
 * songs-allowance.ts), so the date is read in UTC too and is the 1st
 * wherever the phone is.
 */
export function nextFreeSongOn(now: Date = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )
  return next.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** The offer's line above the plan, once the month's free song is used. */
export function nextFreeSongLine(now: Date = new Date()): string {
  return `Your next free song comes on ${nextFreeSongOn(now)}.`
}

/**
 * A signed-in singer without a subscription whose month's free song is
 * used: the server counts it among the songs left (owner, S7 D5), so none
 * left means it is spent. Not for a singer the server says gets none a
 * month (`monthly` false): none left is then not a song spent, and no next
 * one is coming. An older server that does not say is read as before.
 */
export function freeSongUsed(state: KaraokeSongs, account: boolean): boolean {
  return (
    account && !state.subscribed && state.left === 0 && state.monthly !== false
  )
}

/**
 * A signed-in singer without a subscription the server gives no free song a
 * month (`monthly` false). Only the server's word counts: an older server
 * that does not say withholds nothing here.
 */
export function freeSongWithheld(
  state: KaraokeSongs,
  account: boolean,
): boolean {
  return account && !state.subscribed && state.monthly === false
}

/** The account, as /api/auth/me describes it. */
interface FreeSongAccount {
  readonly authProvider: string
  readonly email: string | null
  readonly emailVerified: boolean
}

/**
 * Whether confirming its email is what stands between this account and the
 * month's free song. The server gives it to an account that is not
 * anonymous, has an email and has confirmed it, without a subscription
 * (db-worker songs-allowance.ts getsFreeSong); the subscription is the
 * caller's to rule out (freeSongWithheld).
 */
export function confirmEmailForFreeSong(user: FreeSongAccount): boolean {
  return (
    user.authProvider !== 'anonymous' &&
    user.email !== null &&
    user.email !== '' &&
    !user.emailVerified
  )
}

/** The offer's line above the plan, for an account whose email is not
 *  confirmed yet (confirmEmailForFreeSong). */
export const CONFIRM_FOR_FREE_SONG_LINE =
  'Confirm your email for 1 free song a month.'

/** Settings, Karaoke: the subscription's status line (plan §9). */
export function subscriptionStatusLine(state: KaraokeSongs): string {
  if (!state.subscribed) return 'Not subscribed'
  const on = formatRenewal(state.renewsAt)
  return on === null ? 'Subscribed' : `Subscribed, renews on ${on}`
}

/**
 * What the store answered to Restore purchases, in the paywall and in
 * Settings alike (plan §6.7, §9), so the two can never say it differently.
 */
export function restoreNote(outcome: KaraokeRestoreOutcome): string {
  switch (outcome) {
    case 'restored':
      return `Your ${CLOUD_NAME} subscription is restored.`
    case 'nothing':
      return `No ${CLOUD_NAME} subscription was found to restore.`
    case 'unavailable':
      return 'Purchases are not available yet.'
    case 'failed':
      return 'The store could not restore purchases. Try again in a moment.'
  }
}
