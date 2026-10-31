// ============================================================
// Legend store — the Legend the More sheet's row names, kept on the phone
// ============================================================
//
// The More sheet reads its lines synchronously and never asks the network as
// it opens (more-lines.ts), so its Legend row needs the running Legend
// already on the phone. This keeps it: the challenge's id, title and close,
// for anyone, and the singer's own best on it, for the account that sang it.
// Read as the shell starts, on the app's return to the front at most every
// quarter of an hour, once the kept Legend has closed, and after a take is
// posted (`weeklyAttemptVersion`); the room reads it again as it opens.
// Neither the row nor the sheet ever does. Asks that overlap share one read.
//
// A Legend is keyed on its id and its close, never on the running week: a
// Legend runs one to eight weeks and stays open two days past its close, and
// every encore is a new id (MISTAKES.md, "A watermark that names the running
// week must include it next time"). Nothing about other singers is kept: the
// board's names stay with the room that showed them.
//
// Behind NATIVE_LEAGUES (src/lib/native-build.ts). The native config lists
// this module as free of side effects, so a store build, where nothing
// reaches it, carries none of it, its key included (assert-bundle.mjs
// STAGE 2, `mp:legend-card`).

import { batch, createEffect, createRoot, createSignal, on, untrack, } from 'solid-js'
import { accountHeld, currentAccountId } from '@/db/services/auth-service'
import { weeklyAttemptVersion } from '@/features/challenges/weekly-attempt'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { getWeeklyBoard, readActiveWeekly, } from '@/features/challenges/weekly-service'

/** What the row says of the running Legend. */
export interface LegendFacts {
  id: string
  title: string
  /** ISO: when it closes (takes still count for two days after). */
  endsAt: string
}

/** The singer's own best on one Legend, for the account that sang it. */
export interface LegendStanding {
  accountId: string
  challengeId: string
  best: number
  completed: boolean
}

interface KeptLegend {
  readAt: number
  /** The account the read asked for, or null: read for nobody's best. */
  readFor: string | null
  /** Null: nothing is running. */
  challenge: LegendFacts | null
  standing: LegendStanding | null
}

const CARD_KEY = 'mp:legend-card'

/** How long a read stays fresh enough not to ask again on a return. */
export const LEGEND_FRESH_MS = 15 * 60 * 1000

function factsOf(value: unknown): LegendFacts | null {
  if (typeof value !== 'object' || value === null) return null
  const facts = value as Record<string, unknown>
  return typeof facts.id === 'string' &&
    typeof facts.title === 'string' &&
    typeof facts.endsAt === 'string'
    ? { id: facts.id, title: facts.title, endsAt: facts.endsAt }
    : null
}

function standingOf(value: unknown): LegendStanding | null {
  if (typeof value !== 'object' || value === null) return null
  const standing = value as Record<string, unknown>
  return typeof standing.accountId === 'string' &&
    typeof standing.challengeId === 'string' &&
    typeof standing.best === 'number' &&
    typeof standing.completed === 'boolean'
    ? {
        accountId: standing.accountId,
        challengeId: standing.challengeId,
        best: standing.best,
        completed: standing.completed,
      }
    : null
}

function keptOf(value: unknown): KeptLegend | null {
  if (typeof value !== 'object' || value === null) return null
  const kept = value as Record<string, unknown>
  if (typeof kept.readAt !== 'number') return null
  return {
    readAt: kept.readAt,
    readFor: typeof kept.readFor === 'string' ? kept.readFor : null,
    challenge: factsOf(kept.challenge),
    standing: standingOf(kept.standing),
  }
}

function readKept(): KeptLegend | null {
  try {
    const raw = localStorage.getItem(CARD_KEY)
    return raw === null ? null : keptOf(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeKept(kept: KeptLegend | null): void {
  try {
    if (kept === null) localStorage.removeItem(CARD_KEY)
    else localStorage.setItem(CARD_KEY, JSON.stringify(kept))
  } catch {
    // Private mode or blocked storage: the Legend is simply not kept.
  }
}

const [kept, setKept] = createSignal<KeptLegend | null>(readKept())

/** Bumped per read, so a slow answer cannot overwrite a newer one. */
let generation = 0

/** The read that is out, and whose: a second ask for that account shares it. */
let inflight: { accountId: string | null; done: Promise<void> } | null = null

/**
 * The running Legend as last read: undefined before any read, null when
 * nothing was running. Public, so kept for anyone. Reactive.
 */
export function legendCard(): LegendFacts | null | undefined {
  const card = kept()
  return card === null ? undefined : card.challenge
}

/**
 * The account signed in now's best on the kept Legend, or null: no take
 * yet, another account's, or no account. Reactive.
 */
export function legendStanding(): LegendStanding | null {
  if (!accountHeld()) return null
  const card = kept()
  const standing = card?.standing ?? null
  return standing !== null &&
    standing.accountId === currentAccountId() &&
    standing.challengeId === card?.challenge?.id
    ? standing
    : null
}

/** Let the account's own best go: the phone signed out, or changed hands. */
export function forgetLegendStanding(): void {
  const card = untrack(kept)
  if (card === null || card.standing === null) return
  const next = { ...card, standing: null }
  setKept(next)
  writeKept(next)
}

/**
 * Read the running Legend again, and the account's best on it. Never
 * throws, and an ask while a read for the same account is out shares that
 * read. A read that gets no answer keeps what the phone had.
 */
export function refreshLegend(): Promise<void> {
  const accountId = untrack(accountHeld) ? currentAccountId() : null
  if (inflight !== null && inflight.accountId === accountId) {
    return inflight.done
  }
  const mine = ++generation
  const done = readLegend(mine, accountId).finally(() => {
    if (inflight?.done === done) inflight = null
  })
  inflight = { accountId, done }
  return done
}

async function readLegend(
  mine: number,
  accountId: string | null,
): Promise<void> {
  const read = await readActiveWeekly()
  const challenge = read.status === 'ok' ? read.challenge : undefined
  const board =
    challenge !== undefined && challenge !== null && accountId !== null
      ? await getWeeklyBoard(challenge.id)
      : null
  if (mine !== generation) return
  batch(() => {
    // No answer: keep what the phone had.
    if (challenge === undefined) return
    const before = untrack(kept)
    const you = board?.you ?? null
    const standing: LegendStanding | null =
      challenge === null || accountId === null
        ? null
        : you !== null && currentAccountId() === accountId
          ? {
              accountId,
              challengeId: challenge.id,
              best: Math.round(you.best),
              completed: you.completed,
            }
          : // The board did not answer: the best already kept still holds.
            board === null &&
              before?.standing?.accountId === accountId &&
              before.standing.challengeId === challenge.id
            ? before.standing
            : null
    const next: KeptLegend = {
      readAt: Date.now(),
      readFor: accountId,
      challenge: challenge === null ? null : factsFrom(challenge),
      standing,
    }
    setKept(next)
    writeKept(next)
  })
}

function factsFrom(challenge: WeeklyChallenge): LegendFacts {
  return {
    id: challenge.id,
    title: challenge.title,
    endsAt: challenge.endsAt,
  }
}

/** True when the kept read is fresh and the Legend it names is still open. */
function keptHolds(now: number): boolean {
  const card = untrack(kept)
  if (card === null || now - card.readAt >= LEGEND_FRESH_MS) return false
  const challenge = card.challenge
  return challenge === null || Date.parse(challenge.endsAt) > now
}

/**
 * Keep the Legend current while the app is in use: read it as the shell
 * starts, on each return to the front unless the last read is fresh and
 * its Legend still open, after every posted take, and let the account's
 * own best go when the phone signs out or changes hands. Returns the
 * teardown.
 */
export function installLegendRefresh(): () => void {
  const maybeRead = (): void => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return
    }
    if (keptHolds(Date.now())) return
    void refreshLegend()
  }
  const stopWatching = createRoot((dispose) => {
    // The account the token names: another's best goes, and a read made
    // for someone else is made again for this one; otherwise the cold
    // start's read, unless what is kept still holds.
    createEffect(() => {
      const id = accountHeld() ? currentAccountId() : null
      const card = untrack(kept)
      if (card?.standing != null && card.standing.accountId !== id) {
        forgetLegendStanding()
      }
      if (card !== null && card.readFor !== id) {
        void refreshLegend()
        return
      }
      untrack(maybeRead)
    })
    // A take was posted: its best is on the board now.
    createEffect(
      on(
        weeklyAttemptVersion,
        () => {
          void refreshLegend()
        },
        { defer: true },
      ),
    )
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
export function resetLegendStoreForTests(): void {
  generation++
  inflight = null
  setKept(null)
  writeKept(null)
}
