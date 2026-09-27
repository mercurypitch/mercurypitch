// ============================================================
// The fill after signing in — what arrived, said once
// ============================================================
//
// Signing in to an account that already existed brings its history to the
// phone: Progress and the Voice list read the account from then on. The
// Account screen says so once, on the first visit after the sign-in (4b,
// REQ-NAM-043, 044), with the counts read the way Progress reads them. A
// read that fails is named as a failure, with the phone's own records
// untouched and a retry offered (REQ-NAM-045), never as a count of zero.
//
// "Due" is kept on the phone, for the account that signed in, so the note
// waits for the first visit even when the sign-in happened in a room (the
// offer after a kept take), and it is never shown for another account.

import { currentAccountId } from '@/db/services/auth-service'
import { loadProgressSessionRecords } from '@/db/services/session-service'
import { loadProgressVoiceprints } from '@/db/services/voiceprint-service'
import { PROGRESS_SESSION_LIMIT } from '@/features/progress/model'
import { isProgressRun, runFromRecord } from '@/features/progress/run-kinds'

const DUE_KEY = 'mp:account-fill-due'

/** Progress's own paging, so the counts are the ones Progress will show. */
const PAGE = { pageSize: 500, maxRecords: PROGRESS_SESSION_LIMIT } as const

export type AccountFill =
  | { status: 'ok'; runs: number; voiceprints: number }
  | { status: 'failed' }

/** A sign-in to an existing account landed: the note is due for it. */
export function markAccountFillDue(accountId: string): void {
  try {
    localStorage.setItem(DUE_KEY, accountId)
  } catch {
    // Blocked storage: the note is simply not shown. Nothing is lost.
  }
}

/** Due, and for the account signed in now. */
export function accountFillDue(): boolean {
  try {
    const due = localStorage.getItem(DUE_KEY)
    return due !== null && due === currentAccountId()
  } catch {
    return false
  }
}

/** Shown: not due again. */
export function settleAccountFill(): void {
  try {
    localStorage.removeItem(DUE_KEY)
  } catch {
    // As above.
  }
}

/** Sign-out and deletion drop it with the session. */
export const forgetAccountFill = settleAccountFill

/** Count what the account holds. Never throws. */
export async function loadAccountFill(): Promise<AccountFill> {
  try {
    const [sessions, voiceprints] = await Promise.all([
      loadProgressSessionRecords(PAGE),
      loadProgressVoiceprints(PAGE),
    ])
    if (!sessions.available || !voiceprints.available) {
      return { status: 'failed' }
    }
    return {
      status: 'ok',
      runs: sessions.records.map(runFromRecord).filter(isProgressRun).length,
      voiceprints: voiceprints.records.length,
    }
  } catch {
    return { status: 'failed' }
  }
}
