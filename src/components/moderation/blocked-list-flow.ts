// ============================================================
// The Blocked singers list — reading it, and lifting a block from it
// ============================================================
//
// Shared by the phone's Settings screen and the web's account settings, so
// both read and unblock the same way. The list is the account's: it is read
// for the registered account signed in now, as the list opens and again
// whenever an account signs in, and shows nobody's list while none is.
// What stands in for it (`stop`) says why: nobody signed in, a device with
// no account, a session the server refused (asked to sign in again, as
// every refused read is), a suspended account (told so, never asked to
// sign in), or a read that got no list, which keeps what was shown until a
// read lands. While a read or an unblock is out, the buttons that started
// it stay where they are (the hosts mark them aria-disabled), so the focus
// they hold stays too.

import { createEffect, createMemo, createSignal, on, untrack } from 'solid-js'
import { accountHeld, currentAccountId, handleCloudSessionRejected, hasValidToken, storedTokenProvider, } from '@/db/services/auth-service'
import type { BlockedSinger, ModerationProblem, } from '@/db/services/moderation-service'
import { readBlockedSingers, unblockSingerAndShow, } from '@/stores/blocked-singers-store'
import type { ListStop } from './blocked-list-copy'

export interface UnblockFailure {
  name: string
  problem: ModerationProblem
}

export interface BlockedList {
  /** The list as last read for this account, less those since unblocked. */
  singers: () => readonly BlockedSinger[] | null
  reading: () => boolean
  /** What stands in for the list, or null while it can be shown. */
  stop: () => ListStop | null
  /** The singer being unblocked, while it is out. */
  unblocking: () => string | null
  unblockFailed: () => UnblockFailure | null
  load: () => Promise<void>
  /** True when the block was lifted. */
  unblock: (singer: BlockedSinger) => Promise<boolean>
}

export interface BlockedListOptions {
  /** After the read for an account that signed in with the list open. */
  onSignedInRead?: () => void
}

interface Read {
  accountId: string
  singers: readonly BlockedSinger[]
}

/** The registered account signed in now, or null. Reactive. */
function heldAccountId(): string | null {
  return accountHeld() ? currentAccountId() : null
}

/** A device identity, not an account: blocking is not for it. */
function anonymousHeld(): boolean {
  return hasValidToken() && storedTokenProvider() === 'anonymous'
}

/** What stands in for the list, from the last problem and who holds it. */
export function listStop(
  problem: ModerationProblem | null,
  holder: string | null,
  anonymous: boolean,
): ListStop | null {
  // The suspension signed the account out, and is still what to say.
  if (problem === 'suspended') return 'suspended'
  if (holder !== null) return problem
  if (problem === 'refused') return 'refused'
  return anonymous ? 'account' : 'signed-out'
}

export function createBlockedList(
  options: BlockedListOptions = {},
): BlockedList {
  const holder = createMemo(heldAccountId)
  const [read, setRead] = createSignal<Read | null>(null)
  const [readingFor, setReadingFor] = createSignal<string | null>(null)
  const [failed, setFailed] = createSignal<ModerationProblem | null>(null)
  const [unblocking, setUnblocking] = createSignal<string | null>(null)
  const [unblockFailed, setUnblockFailed] = createSignal<UnblockFailure | null>(
    null,
  )

  const singers = (): readonly BlockedSinger[] | null => {
    const last = read()
    return last !== null && last.accountId === holder() ? last.singers : null
  }
  const reading = (): boolean =>
    readingFor() !== null && readingFor() === holder()
  const stop = (): ListStop | null => {
    const id = holder()
    return listStop(failed(), id, id === null && anonymousHeld())
  }

  /** The account is not signed in here any more: the list says why. */
  function signedOutBy(problem: 'refused' | 'suspended'): void {
    setFailed(problem)
    if (problem === 'refused') handleCloudSessionRejected()
  }

  async function load(): Promise<void> {
    const accountId = untrack(holder)
    if (accountId === null || untrack(readingFor) === accountId) return
    setReadingFor(accountId)
    const answer = await readBlockedSingers()
    if (untrack(readingFor) === accountId) setReadingFor(null)
    // Signed out by the read itself: said, though nobody holds it now.
    if (answer.status === 'suspended') {
      signedOutBy('suspended')
      return
    }
    // The device changed hands while it was out: not this account's list.
    if (untrack(holder) !== accountId) return
    if (answer.status === 'ok') {
      setRead({ accountId, singers: answer.blocks })
      setFailed(null)
    } else if (answer.status === 'refused') {
      signedOutBy('refused')
    } else {
      setFailed(answer.status)
    }
  }

  // Read for each account as it signs in, the first included. Another
  // account's trouble, like its list, is not this one's.
  createEffect(
    on(holder, (accountId, was) => {
      if (accountId === null) return
      setFailed(null)
      setUnblockFailed(null)
      void load().then(() => {
        if (was !== undefined) options.onSignedInRead?.()
      })
    }),
  )

  async function unblock(singer: BlockedSinger): Promise<boolean> {
    if (unblocking() !== null) return false
    const accountId = untrack(holder)
    setUnblocking(singer.userId)
    setUnblockFailed(null)
    const outcome = await unblockSingerAndShow(singer.userId)
    setUnblocking(null)
    if (outcome.status === 'unblocked') {
      setRead((last) =>
        last === null || last.accountId !== accountId
          ? last
          : {
              ...last,
              singers: last.singers.filter(
                (kept) => kept.userId !== singer.userId,
              ),
            },
      )
      return true
    }
    if (outcome.status === 'suspended' || outcome.status === 'refused') {
      signedOutBy(outcome.status)
      return false
    }
    setUnblockFailed({ name: singer.displayName, problem: outcome.status })
    return false
  }

  return {
    singers,
    reading,
    stop,
    unblocking,
    unblockFailed,
    load,
    unblock,
  }
}
