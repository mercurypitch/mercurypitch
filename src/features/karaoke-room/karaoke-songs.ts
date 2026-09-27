// ============================================================
// The Karaoke room's songs: what is left, and how it is said (plan S8 §6.7)
// ============================================================
//
// The singer sees songs, never credits. Under the hood a song up to twelve
// minutes is one credit in the ledger, and the Karaoke subscription grants a
// number of them each month into it (db-worker revenuecat.ts), so "songs
// left" is the balance `/api/billing/me` reports. A worker that does not
// yet say `songs` is read as its balance with no subscription: on a dev
// build the account's existing credits are what Import spends (owner, 27
// Sep), and nothing is known to renew.
//
// Nothing here buys anything. The paywall is KaraokeImport's, and its
// Subscribe goes through the shell (nativeShellApi().karaokeSubscription).

import { createSignal } from 'solid-js'
import { requireAuth } from '@/db/services/auth-service'
import { fetchBillingMe } from '@/db/services/billing-service'
import type { KaraokeRestoreOutcome } from '@/stores/native-shell-store'

/**
 * The subscription as the paywall states it, until the store's own product
 * says otherwise (owner, 27 Sep: 20 songs a month at 4.99; S7 still owns the
 * yearly price). The server's `perPeriod` wins wherever it is known.
 */
export const KARAOKE_PLAN = Object.freeze({
  songsPerMonth: 20,
  price: '€4.99',
})

export interface KaraokeSongs {
  /** Songs that can still be separated, or null until the server has said. */
  readonly left: number | null
  /** A Karaoke subscription that has not ended. */
  readonly subscribed: boolean
  /** When the next songs arrive, while subscribed. */
  readonly renewsAt: string | null
  /** Songs a month grants. */
  readonly perPeriod: number
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
  if (options.identify === true) {
    await requireAuth().catch(() => false)
  }
  const me = await fetchBillingMe()
  if (me === null) return songs()
  const next: KaraokeSongs =
    me.songs === undefined
      ? {
          left: Math.max(0, Math.floor(me.creditBalance)),
          subscribed: false,
          renewsAt: null,
          perPeriod: KARAOKE_PLAN.songsPerMonth,
        }
      : {
          left: me.songs.left,
          subscribed: me.songs.subscribed,
          renewsAt: me.songs.renewsAt,
          perPeriod: me.songs.perPeriod,
        }
  setSongs(next)
  return next
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
 * "18 of 20 songs left this month." Past the month's grant (songs carried
 * over) or without a subscription it is the plain count. Null while
 * nothing is known.
 */
export function songsLeftSentence(state: KaraokeSongs): string | null {
  if (state.left === null) return null
  if (withinMonth(state)) {
    return `${state.left} of ${state.perPeriod} songs left this month.`
  }
  if (state.left === 0) return 'No songs left.'
  return `${state.left} ${plural(state.left, 'song', 'songs')} left.`
}

/** The line under Import a song (mock 4b, 4c). */
export function importLine(state: KaraokeSongs): string {
  if (state.left === 0 && !state.subscribed) {
    return 'Any song from Files. Our server separates the voice from the music, and the song then lives on this phone. Part of the subscription.'
  }
  const sentence = songsLeftSentence(state)
  const what = 'Songs from Files: MP3, M4A, WAV or FLAC, up to 12 minutes.'
  return sentence === null ? what : `${what} ${sentence}`
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

/** The no-songs sheet's first line (plan §6.6, mock 8c). */
export function songsComeBackLine(state: KaraokeSongs): string {
  const on = formatRenewal(state.renewsAt)
  return on === null
    ? `Your ${state.perPeriod} songs come back next month.`
    : `Your ${state.perPeriod} songs come back on ${on}.`
}

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
      return 'Your Karaoke subscription is restored.'
    case 'nothing':
      return 'No Karaoke subscription was found to restore.'
    case 'unavailable':
      return 'Purchases are not available yet.'
    case 'failed':
      return 'The store could not restore purchases. Try again in a moment.'
  }
}
