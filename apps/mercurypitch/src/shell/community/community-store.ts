// ============================================================
// Community store — what the Community screen last loaded
// ============================================================
//
// The phone's Community (slice 4c of docs/plans/native-more-and-community.md)
// reads the public melodies and results, and a signed-in singer's own
// figures, as its screen opens, when Try again asks and after a block made
// from it. What a read found stays here, in memory, so the screen comes
// back to it at once from a shared result it opened, and so the More
// sheet's row has a line without asking anything.
//
// WHOSE READ. The worker hides the singers in a block with the reader
// (REQ-RB-011), so a board read for one account is never shown to another,
// nor its counts: every answer is kept with the account it was read for
// (`viewerNow`, null with no registered account) and read for that account
// alone.
//
// THE PHONE KEEPS NO BOARD. Storage holds two numbers for the More row's
// line, how many melodies and results the last load found, under
// `mp:community-card`, with the account they were counted for. Never a
// name, a title or a share: those stay in memory, for the screens that show
// them. Only the screen fills it; the sheet reads it (more-lines.ts).
//
// A read that gets no answer says so (`communityProblem`) and keeps what
// was loaded before; one the phone knows to be offline is not sent at all.
//
// A RESULT OPENED FROM THE LIST is kept as it was opened, with the account
// that opened it and where the list was scrolled to, so Back lands on its
// row, in view, without asking the worker anything, and the result screen,
// drawn again later, can say what is true of it now (`openedResultState`).
//
// WHEN THE ACCOUNT CHANGES (`installCommunityWatch`), everything kept for
// the account before goes, its counts in storage included, as the league
// the Leagues row names goes. A token refreshed for the same account is
// not a change.
//
// Behind NATIVE_COMMUNITY (src/lib/native-build.ts). The native config lists
// this module as free of side effects, so a store build, where nothing
// reaches it, carries none of it, its key included (assert-bundle.mjs
// STAGE 2, `mp:community-card`).

import { batch, createEffect, createMemo, createRoot, createSignal, on, untrack, } from 'solid-js'
import { accountHeld, currentAccountId } from '@/db/services/auth-service'
import { loadProgressSessionRecords } from '@/db/services/progress-session-records'
import type { PublishedShareCounts, SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'
import { loadPublishedShareCounts, loadUserProfile, readSharedMelodies, readSharedSessions, } from '@/db/services/share-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import type { ProgressRun } from '@/features/progress/run-kinds'
import { isProgressRun, runFromRecord } from '@/features/progress/run-kinds'
import { blockedSingerIds } from '@/stores/blocked-singers-store'
import type { CommunityCounts } from '../more-lines'

/** What other singers shared, as the last read found it. */
export interface CommunityBoard {
  melodies: SharedMelodyView[]
  results: SharedSessionView[]
}

/** The signed-in singer's own figures (ProfileView's, read for the phone). */
export interface CommunityProfile {
  /** The profile's display name, '' when it has none. */
  name: string
  /** When the account was made, or null when the profile was not read. */
  joinedAt: number | null
  runs: ProgressRun[]
  /** Every run the account holds, when there are more than were read. */
  totalRuns: number
  streak: number
  /** The singer's own public shares, or null when they could not be counted. */
  published: PublishedShareCounts | null
}

/** Why the last read showed nothing new. */
export type CommunityProblem = 'offline' | 'unreachable'

/** What the result screen can truthfully show of the result opened. */
export type OpenedResultState =
  /** The result, as the latest read for this account has it. */
  | { kind: 'shown'; result: SharedSessionView }
  /** Its singer is blocked: nothing of theirs is shown. */
  | { kind: 'blocked' }
  /** The latest read no longer has it, or nothing was opened. */
  | { kind: 'gone' }
  /** Another account, or none, is signed in since it was opened. */
  | { kind: 'account' }

/** One answer, and the account it was read for. */
interface Kept<T> {
  viewer: string | null
  value: T
}

interface KeptCounts extends CommunityCounts {
  viewer: string | null
  readAt: number
}

const COUNTS_KEY = 'mp:community-card'

function countsOf(value: unknown): KeptCounts | null {
  if (typeof value !== 'object' || value === null) return null
  const kept = value as Record<string, unknown>
  const viewer = kept.viewer
  if (
    (viewer !== null && typeof viewer !== 'string') ||
    typeof kept.readAt !== 'number' ||
    typeof kept.melodies !== 'number' ||
    typeof kept.results !== 'number'
  ) {
    return null
  }
  return {
    viewer,
    readAt: kept.readAt,
    melodies: kept.melodies,
    results: kept.results,
  }
}

function readCounts(): KeptCounts | null {
  try {
    const raw = localStorage.getItem(COUNTS_KEY)
    return raw === null ? null : countsOf(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeCounts(counts: KeptCounts | null): void {
  try {
    if (counts === null) localStorage.removeItem(COUNTS_KEY)
    else localStorage.setItem(COUNTS_KEY, JSON.stringify(counts))
  } catch {
    // Private mode or blocked storage: the row says what Community is for.
  }
}

const [board, setBoard] = createSignal<Kept<CommunityBoard> | null>(null)
const [profile, setProfile] = createSignal<Kept<CommunityProfile> | null>(null)
const [counts, setCounts] = createSignal<KeptCounts | null>(readCounts())
const [reading, setReading] = createSignal(false)
const [problem, setProblem] = createSignal<Kept<CommunityProblem> | null>(null)
/** The shared result the singer opened from the list, as it was then. */
const [opened, setOpened] = createSignal<Kept<SharedSessionView> | null>(null)

/** Where the list was scrolled to when a result was opened from it. */
let listTop: Kept<number> | null = null

/** Bumped per read, so a slow answer cannot overwrite a newer one. */
let generation = 0

/** The read that is out, and whose: a second ask for that account shares it. */
let inflight: { viewer: string | null; done: Promise<void> } | null = null

/**
 * Whose view a read is: the registered account signed in now, or null for
 * a phone without one. Reactive.
 */
export function viewerNow(): string | null {
  return accountHeld() ? currentAccountId() : null
}

function forViewer<T>(kept: Kept<T> | null): T | null {
  return kept !== null && kept.viewer === viewerNow() ? kept.value : null
}

/** What the last read found for the account signed in now, or null. */
export function communityBoard(): CommunityBoard | null {
  return forViewer(board())
}

/** The signed-in singer's figures, once read; null for anyone else. */
export function communityProfile(): CommunityProfile | null {
  return viewerNow() === null ? null : forViewer(profile())
}

/** A read is out. */
export function communityReading(): boolean {
  return reading()
}

/** Why the last read for this account got nothing, until one does. */
export function communityProblem(): CommunityProblem | null {
  return forViewer(problem())
}

/**
 * How many melodies and results the screen found when it last loaded for
 * the account signed in now: the More row's line. Null before that load,
 * and for any other account. Reactive.
 */
export function communityCounts(): CommunityCounts | null {
  const kept = counts()
  if (kept === null || kept.viewer !== viewerNow()) return null
  return { melodies: kept.melodies, results: kept.results }
}

/**
 * Open a shared result from the list, `top` being where the list is
 * scrolled to: Back comes back to both.
 */
export function openCommunityResult(
  result: SharedSessionView,
  top: number,
): void {
  const viewer = untrack(viewerNow)
  listTop = { viewer, value: top }
  setOpened({ viewer, value: result })
}

/** The id of the shared result the singer last opened, or null. */
export function openedResultId(): string | null {
  return opened()?.value.id ?? null
}

/** Where the list was when this account opened a result, or null. */
export function communityListTop(): number | null {
  return listTop !== null && listTop.viewer === untrack(viewerNow)
    ? listTop.value
    : null
}

/**
 * Let the opened result go: Community pushed afresh opens at its title,
 * while Back from a result lands on the row that opened it.
 */
export function forgetCommunityResult(): void {
  setOpened(null)
}

/**
 * The result opened, and what may be shown of it now. Reactive: a block,
 * a read that drops it and an account change each answer differently.
 */
export function openedResultState(): OpenedResultState {
  const kept = opened()
  if (kept === null) return { kind: 'gone' }
  if (kept.viewer !== viewerNow()) return { kind: 'account' }
  if (blockedSingerIds().has(kept.value.userId)) return { kind: 'blocked' }
  const read = communityBoard()
  if (read === null) return { kind: 'shown', result: kept.value }
  const now = read.results.find((result) => result.id === kept.value.id)
  return now === undefined ? { kind: 'gone' } : { kind: 'shown', result: now }
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** The singer's figures, or null when their runs could not be read. */
async function readProfile(viewer: string): Promise<CommunityProfile | null> {
  const [history, streak, published, own] = await Promise.all([
    loadProgressSessionRecords(),
    getCurrentStreak(viewer),
    loadPublishedShareCounts(viewer).catch(() => null),
    loadUserProfile(),
  ])
  if (!history.available) return null
  const runs = history.records.map(runFromRecord).filter(isProgressRun)
  return {
    name: own?.userId === viewer ? own.displayName.trim() : '',
    joinedAt: own?.userId === viewer ? own.joinDate : null,
    runs,
    totalRuns: Math.max(runs.length, history.totalAvailable ?? 0),
    streak,
    published,
  }
}

/**
 * Read what other singers shared, and the signed-in singer's figures. Never
 * throws. An ask while a read for the same account is out shares it, unless
 * it asks for a `fresh` read: a block wants an answer given after it. A read
 * that gets no answer keeps what was loaded and says so; offline, the phone
 * asks nothing.
 */
export function refreshCommunity(fresh = false): Promise<void> {
  const viewer = untrack(viewerNow)
  if (!fresh && inflight !== null && inflight.viewer === viewer) {
    return inflight.done
  }
  const mine = ++generation
  const done = readCommunity(mine, viewer).finally(() => {
    if (inflight?.done === done) inflight = null
  })
  inflight = { viewer, done }
  return done
}

type CommunityRead = [
  SharedMelodyView[],
  SharedSessionView[],
  CommunityProfile | null,
]

/** The newest read's own: an older one that lands late changes nothing. */
async function readCommunity(
  mine: number,
  viewer: string | null,
): Promise<void> {
  if (offline()) {
    batch(() => {
      setReading(false)
      setProblem({ viewer, value: 'offline' })
    })
    return
  }
  setReading(true)
  let read: CommunityRead
  try {
    read = await Promise.all([
      readSharedMelodies(),
      readSharedSessions(),
      viewer === null ? Promise.resolve(null) : readProfile(viewer),
    ])
  } catch {
    if (mine === generation) failed(viewer)
    return
  }
  if (mine !== generation) return
  // The answer is the account's that asked: if the phone changed hands
  // while it was out, it is nobody's.
  if (untrack(viewerNow) === viewer) landed(viewer, read)
  else setReading(false)
}

/**
 * The new read's rows, each one that has not changed kept as the object the
 * screen already drew: Solid draws a row anew for a new object, and a row
 * drawn anew takes the focus on its buttons with it.
 */
function keepSame<T extends { id: string }>(
  before: readonly T[] | undefined,
  after: readonly T[],
): T[] {
  if (before === undefined) return [...after]
  const drawn = new Map(before.map((row) => [row.id, row]))
  return after.map((row) => {
    const was = drawn.get(row.id)
    return was !== undefined && JSON.stringify(was) === JSON.stringify(row)
      ? was
      : row
  })
}

function failed(viewer: string | null): void {
  batch(() => {
    setReading(false)
    setProblem({ viewer, value: offline() ? 'offline' : 'unreachable' })
  })
}

function landed(viewer: string | null, read: CommunityRead): void {
  const [melodies, results, own] = read
  const before = untrack(board)
  const drawn = before?.viewer === viewer ? before.value : undefined
  batch(() => {
    setReading(false)
    setBoard({
      viewer,
      value: {
        melodies: keepSame(drawn?.melodies, melodies),
        results: keepSame(drawn?.results, results),
      },
    })
    // Signed in, figures that could not be read are a failed read: a
    // profile of no runs would be a profile that is wrong.
    if (viewer !== null && own === null) {
      setProblem({ viewer, value: 'unreachable' })
    } else {
      setProblem(null)
    }
    if (viewer !== null && own !== null) setProfile({ viewer, value: own })
    const kept: KeptCounts = {
      viewer,
      readAt: Date.now(),
      melodies: melodies.length,
      results: results.length,
    }
    setCounts(kept)
    writeCounts(kept)
  })
}

/**
 * Let go of everything kept for an account: its read, its figures, its
 * counts in storage and where its list was. A result screen still up keeps
 * what it opened, to say the account changed.
 */
export function forgetCommunity(): void {
  // A read still out for the account before lands as nobody's
  // (readCommunity); one already out for the account now is left alone.
  listTop = null
  batch(() => {
    setBoard(null)
    setProfile(null)
    setProblem(null)
    setCounts(null)
  })
  writeCounts(null)
}

/** Something is kept for an account other than `viewer`. */
function keptForAnother(viewer: string | null): boolean {
  return [untrack(counts), untrack(board), untrack(profile), listTop].some(
    (kept) => kept !== null && kept.viewer !== viewer,
  )
}

/**
 * Let go of what was kept for an account once it signs out or the phone
 * changes hands, and of counts left in storage for an account that is not
 * the one here as the shell starts. Keyed by the account, so a token
 * refreshed for it changes nothing. Returns the teardown.
 */
export function installCommunityWatch(): () => void {
  return createRoot((dispose) => {
    const viewer = createMemo(viewerNow)
    createEffect(
      on(viewer, (now) => {
        if (keptForAnother(now)) forgetCommunity()
      }),
    )
    return dispose
  })
}

/** Tests: nothing read, nothing kept, nothing open. */
export function resetCommunityStoreForTests(): void {
  generation++
  inflight = null
  setReading(false)
  forgetCommunity()
  setOpened(null)
}
