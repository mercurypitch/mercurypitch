// ============================================================
// The Blocked singers list — reading it, and lifting a block from it
// ============================================================
//
// Shared by the phone's Settings screen and the web's account settings, so
// both read and unblock the same way. A read that gets no list keeps what
// was shown and says why (`failed`) until a read lands; a session the
// server refused is asked to sign in again, as every refused read is. While
// a read or an unblock is out, the buttons that started it stay where they
// are (the hosts mark them aria-disabled), so the focus they hold stays too.

import { createSignal } from 'solid-js'
import { handleCloudSessionRejected } from '@/db/services/auth-service'
import type { BlockedSinger, ModerationProblem, } from '@/db/services/moderation-service'
import { readBlockedSingers, unblockSingerAndShow, } from '@/stores/blocked-singers-store'

export interface UnblockFailure {
  name: string
  problem: ModerationProblem
}

export interface BlockedList {
  /** The list as last read, without the singers since unblocked; null before. */
  singers: () => readonly BlockedSinger[] | null
  reading: () => boolean
  /** Why the last read got no list, until one does. */
  failed: () => ModerationProblem | null
  /** The singer being unblocked, while it is out. */
  unblocking: () => string | null
  unblockFailed: () => UnblockFailure | null
  load: () => Promise<void>
  /** True when the block was lifted. */
  unblock: (singer: BlockedSinger) => Promise<boolean>
}

export function createBlockedList(): BlockedList {
  const [singers, setSingers] = createSignal<readonly BlockedSinger[] | null>(
    null,
  )
  const [reading, setReading] = createSignal(false)
  const [failed, setFailed] = createSignal<ModerationProblem | null>(null)
  const [unblocking, setUnblocking] = createSignal<string | null>(null)
  const [unblockFailed, setUnblockFailed] = createSignal<UnblockFailure | null>(
    null,
  )

  async function load(): Promise<void> {
    if (reading()) return
    setReading(true)
    const read = await readBlockedSingers()
    setReading(false)
    if (read.status === 'ok') {
      setSingers(read.blocks)
      setFailed(null)
      return
    }
    if (read.status === 'refused') handleCloudSessionRejected()
    setFailed(read.status)
  }

  async function unblock(singer: BlockedSinger): Promise<boolean> {
    if (unblocking() !== null) return false
    setUnblocking(singer.userId)
    setUnblockFailed(null)
    const outcome = await unblockSingerAndShow(singer.userId)
    setUnblocking(null)
    if (outcome.status === 'unblocked') {
      setSingers((list) =>
        (list ?? []).filter((kept) => kept.userId !== singer.userId),
      )
      return true
    }
    if (outcome.status === 'refused') handleCloudSessionRejected()
    setUnblockFailed({ name: singer.displayName, problem: outcome.status })
    return false
  }

  return {
    singers,
    reading,
    failed,
    unblocking,
    unblockFailed,
    load,
    unblock,
  }
}
