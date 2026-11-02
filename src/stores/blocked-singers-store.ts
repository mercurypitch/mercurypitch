// ============================================================
// Blocked singers — whom this account blocked, as this device knows it
// ============================================================
//
// A board hides a singer the moment they are blocked from it (slice 4b of
// docs/plans/native-more-and-community.md). The worker leaves them out of
// every read after the block, so what this keeps is for what a screen has
// loaded already: each board filters these ids out of its rows, every other
// row keeping its place as the worker keeps it (REQ-RB-012), then reads its
// data again.
//
// The ids are the account's, never the device's. They are read from
// GET /api/blocks for the registered singer signed in now, the first time a
// board or the Blocked singers list asks, changed by every block and unblock
// made here, and never shown to another account the device signs in to.
// Kept in memory only: nothing about a block is written to the device.

import { createSignal, untrack } from 'solid-js'
import { accountHeld, currentAccountId } from '@/db/services/auth-service'
import type { BlockListRead, BlockOutcome, UnblockOutcome, } from '@/db/services/moderation-service'
import { blockSinger, listBlockedSingers, unblockSinger, } from '@/db/services/moderation-service'

interface Known {
  accountId: string
  ids: ReadonlySet<string>
  /** The account's list has been read here at least once. */
  read: boolean
}

const EMPTY: ReadonlySet<string> = new Set()

const [known, setKnown] = createSignal<Known | null>(null)

/** The read that is out, and whose: a second ask for it shares it. */
let inflight: { accountId: string; done: Promise<BlockListRead> } | null = null

/** Blocks made or lifted here while that read was out, laid over it. */
const madeDuringRead = new Map<string, boolean>()

/** The registered account signed in now, or null. Reactive. */
function heldAccount(): string | null {
  return accountHeld() ? currentAccountId() : null
}

function knownFor(accountId: string): Known {
  const current = untrack(known)
  return current !== null && current.accountId === accountId
    ? current
    : { accountId, ids: EMPTY, read: false }
}

/**
 * The singers the account signed in now has blocked, as far as this device
 * knows. Empty for no account and for every other account. Reactive.
 */
export function blockedSingerIds(): ReadonlySet<string> {
  const accountId = heldAccount()
  const current = known()
  return accountId !== null && current?.accountId === accountId
    ? current.ids
    : EMPTY
}

function note(accountId: string, userId: string, blocked: boolean): void {
  const record = knownFor(accountId)
  const ids = new Set(record.ids)
  if (blocked) ids.add(userId)
  else ids.delete(userId)
  setKnown({ ...record, ids })
  if (inflight?.accountId === accountId) madeDuringRead.set(userId, blocked)
}

/**
 * Read the account's blocked list from the worker, and keep its ids. An ask
 * while a read for the same account is out shares that read. Never throws.
 */
export function readBlockedSingers(): Promise<BlockListRead> {
  const accountId = untrack(heldAccount)
  if (accountId === null) return Promise.resolve({ status: 'account' })
  if (inflight !== null && inflight.accountId === accountId) {
    return inflight.done
  }
  madeDuringRead.clear()
  const done = listBlockedSingers().then((read) => {
    if (inflight?.done === done) inflight = null
    // The answer is the account's that asked: if the device changed hands
    // while it was out, it is nobody's.
    if (read.status !== 'ok' || currentAccountId() !== accountId) return read
    const ids = new Set(read.blocks.map((singer) => singer.userId))
    for (const [userId, blocked] of madeDuringRead) {
      if (blocked) ids.add(userId)
      else ids.delete(userId)
    }
    madeDuringRead.clear()
    setKnown({ accountId, ids, read: true })
    return read
  })
  inflight = { accountId, done }
  return done
}

/** Read the list once for the account signed in now, if it never was. */
export function ensureBlockedSingers(): void {
  const accountId = untrack(heldAccount)
  if (accountId === null || knownFor(accountId).read) return
  void readBlockedSingers()
}

/**
 * Block a singer, and hide them at once from every board on screen. The
 * outcome is the service's (moderation-service.ts), to be worded.
 */
export async function blockSingerAndHide(
  userId: string,
): Promise<BlockOutcome> {
  const accountId = untrack(heldAccount)
  const outcome = await blockSinger(userId)
  if (
    outcome.status === 'blocked' &&
    accountId !== null &&
    currentAccountId() === accountId
  ) {
    note(accountId, userId, true)
  }
  return outcome
}

/** Lift a block. The singer comes back on the next read of a board. */
export async function unblockSingerAndShow(
  userId: string,
): Promise<UnblockOutcome> {
  const accountId = untrack(heldAccount)
  const outcome = await unblockSinger(userId)
  if (
    outcome.status === 'unblocked' &&
    accountId !== null &&
    currentAccountId() === accountId
  ) {
    note(accountId, userId, false)
  }
  return outcome
}

/** Tests: nothing known, nothing read. */
export function resetBlockedSingersForTests(): void {
  inflight = null
  madeDuringRead.clear()
  setKnown(null)
}
