// ============================================================
// League store — the league the More sheet's row names, kept on the phone
// ============================================================
//
// The More sheet reads its lines synchronously and never asks the network
// as it opens (more-lines.ts), so its Leagues row needs a league already on
// the phone. This keeps one: the last answer to /api/league/me for the
// account the token names, under a key settings sync does not touch, with
// the public ladder beside it. The Leagues screen reads it again as it
// opens, and so does the app coming back to the front, at most every
// quarter of an hour; neither the row nor the sheet ever does. Asks that
// overlap share one read.
//
// A league is a week's: one read before Monday's cut is last week's. That
// is judged by this phone's clock at both ends (`leagueReadThisWeek`), not
// against the week the server named, so a clock a day out still shows an
// answer read a moment ago.
//
// It is only ever shown for the account it was read for, and it goes the
// moment the phone signs out or another account signs in. What is written
// to storage is the singer's own league and place, never the board: the
// other members' names stay in memory, for the screen that showed them.
//
// Behind NATIVE_LEAGUES (src/lib/native-build.ts). The native config lists
// this module as free of side effects, so a store build, where nothing
// reaches it, carries none of it, its key included (assert-bundle.mjs
// STAGE 2, `mp:league-card`).

import { batch, createEffect, createRoot, createSignal, untrack, } from 'solid-js'
import { accountHeld, currentAccountId, handleCloudSessionRejected, } from '@/db/services/auth-service'
import type { LeagueMe, LeagueRung } from '@/db/services/league-service'
import { fetchLeagueLadder, readLeagueMe } from '@/db/services/league-service'
import { leagueWeekStart } from '@/lib/league-board'

/** What the phone keeps: one account's league, and when it was read. */
interface KeptLeague {
  accountId: string
  readAt: number
  me: LeagueMe
}

const CARD_KEY = 'mp:league-card'
const LADDER_KEY = 'mp:league-ladder'

/** How long a read stays fresh enough not to ask again on a return. */
export const LEAGUE_FRESH_MS = 15 * 60 * 1000

function keptOf(value: unknown): KeptLeague | null {
  if (typeof value !== 'object' || value === null) return null
  const kept = value as Record<string, unknown>
  const me = kept.me
  if (
    typeof kept.accountId !== 'string' ||
    typeof kept.readAt !== 'number' ||
    typeof me !== 'object' ||
    me === null ||
    typeof (me as Record<string, unknown>).eligible !== 'boolean'
  ) {
    return null
  }
  return { accountId: kept.accountId, readAt: kept.readAt, me: me as LeagueMe }
}

function ladderOf(value: unknown): LeagueRung[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (rung): rung is LeagueRung =>
      typeof rung === 'object' &&
      rung !== null &&
      typeof (rung as Record<string, unknown>).rank === 'number' &&
      typeof (rung as Record<string, unknown>).name === 'string',
  )
}

/** The answer as the phone keeps it: the board's names left out. */
function withoutBoard(me: LeagueMe): LeagueMe {
  const { standings: _standings, ...own } = me
  return own
}

function read<T>(key: string, parse: (value: unknown) => T, empty: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? empty : parse(JSON.parse(raw))
  } catch {
    return empty
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or blocked storage: the league is simply not kept.
  }
}

const [kept, setKept] = createSignal<KeptLeague | null>(
  read(CARD_KEY, keptOf, null),
)
const [ladder, setLadder] = createSignal<LeagueRung[]>(
  read(LADDER_KEY, ladderOf, []),
)
const [reading, setReading] = createSignal(false)
/** The account whose last read got no answer, until one of its reads does. */
const [failedFor, setFailedFor] = createSignal<string | null>(null)

/** Bumped per read, so a slow answer cannot overwrite a newer one. */
let generation = 0

/** The read that is out, and whose: a second ask for that account shares it. */
let inflight: { accountId: string | null; done: Promise<void> } | null = null

/**
 * The league of the account signed in now, as last read: null before the
 * first read, for any other account, and for a phone with no account.
 * Reactive.
 */
export function leagueCard(): LeagueMe | null {
  if (!accountHeld()) return null
  const card = kept()
  return card !== null && card.accountId === currentAccountId() ? card.me : null
}

/**
 * Whether the league kept for this account was read in the league week
 * running now, by this phone's clock. Reactive in what is kept; `nowMs` is
 * the caller's clock.
 */
export function leagueReadThisWeek(nowMs: number = Date.now()): boolean {
  if (leagueCard() === null) return false
  const card = kept()
  return (
    card !== null && leagueWeekStart(card.readAt) === leagueWeekStart(nowMs)
  )
}

/** The rungs, lowest first, as last read. Public, so kept for anyone. */
export function leagueLadder(): readonly LeagueRung[] {
  return ladder()
}

/** A read is out. */
export function leagueReading(): boolean {
  return reading()
}

/**
 * The last read for the account signed in now got no answer, and none has
 * since. Another account's failure is never this one's. Reactive.
 */
export function leagueReadFailed(): boolean {
  const id = failedFor()
  return id !== null && accountHeld() && id === currentAccountId()
}

/** Let the kept league go: the phone signed out, or changed hands. */
export function forgetLeague(): void {
  generation++
  inflight = null
  setKept(null)
  write(CARD_KEY, null)
  setReading(false)
  setFailedFor(null)
}

/**
 * Read the league again, and the ladder with it. Never throws, and an ask
 * while a read for the same account is out shares that read. A read that
 * gets no answer keeps what the phone had and says so (`leagueReadFailed`)
 * until one does; a session the server refuses is asked to sign in again.
 */
export function refreshLeague(): Promise<void> {
  const accountId = untrack(accountHeld) ? currentAccountId() : null
  if (inflight !== null && inflight.accountId === accountId) {
    return inflight.done
  }
  const mine = ++generation
  const done = readLeague(mine, accountId).finally(() => {
    if (inflight?.done === done) inflight = null
  })
  inflight = { accountId, done }
  return done
}

async function readLeague(
  mine: number,
  accountId: string | null,
): Promise<void> {
  setReading(true)
  const [read, rungs] = await Promise.all([
    accountId === null ? Promise.resolve(null) : readLeagueMe(),
    fetchLeagueLadder(),
  ])
  if (mine !== generation) return
  batch(() => {
    setReading(false)
    if (rungs.length > 0) {
      setLadder(rungs)
      write(LADDER_KEY, rungs)
    }
    // The answer is the account's that asked: if the phone changed hands
    // while it was out, it is nobody's.
    if (accountId === null || read === null) return
    if (currentAccountId() !== accountId) return
    if (read.status === 'unreachable') {
      setFailedFor(accountId)
      return
    }
    setFailedFor(null)
    if (read.status === 'refused') {
      // Refused, not unreachable: ask for sign-in again (REQ-NAM-053), as
      // the account card does (account-state.ts). A suspension already
      // cleared the token on its own path, and this is then a no-op.
      handleCloudSessionRejected()
      return
    }
    const card: KeptLeague = { accountId, readAt: Date.now(), me: read.me }
    setKept(card)
    write(CARD_KEY, { ...card, me: withoutBoard(read.me) })
  })
}

/**
 * Keep the league current while the app is in use: read it as the shell
 * starts, for an account that has just signed in, and each time the app
 * comes back to the front, unless what is kept is this account's, from
 * this week, and under a quarter of an hour old. Let it go when the phone
 * signs out or changes hands. Returns the teardown.
 */
export function installLeagueRefresh(): () => void {
  const maybeRead = (): void => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }
    untrack(() => {
      if (!accountHeld()) return
      const card = kept()
      const now = Date.now()
      if (
        card !== null &&
        card.accountId === currentAccountId() &&
        now - card.readAt < LEAGUE_FRESH_MS &&
        leagueReadThisWeek(now)
      ) {
        return
      }
      void refreshLeague()
    })
  }
  // The one place a cold start reads: installed from the shell's onMount,
  // this runs once the mount is done, and a read started anywhere else
  // first is shared, not repeated.
  const stopWatching = createRoot((dispose) => {
    createEffect(() => {
      const held = accountHeld()
      const id = currentAccountId()
      const card = untrack(kept)
      if (card !== null && (!held || card.accountId !== id)) forgetLeague()
      maybeRead()
    })
    return dispose
  })
  if (typeof document === 'undefined') return stopWatching
  document.addEventListener('visibilitychange', maybeRead)
  return () => {
    document.removeEventListener('visibilitychange', maybeRead)
    stopWatching()
  }
}

/** Tests: nothing kept, nothing read. */
export function resetLeagueStoreForTests(): void {
  generation++
  inflight = null
  setKept(null)
  setLadder([])
  setReading(false)
  setFailedFor(null)
  write(CARD_KEY, null)
  write(LADDER_KEY, null)
}
