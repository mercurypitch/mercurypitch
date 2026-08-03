// ============================================================
// Signing in to an account made somewhere else
// ============================================================
//
// Creating an account upgrades THIS device's row in place, so the
// account id and the device id are the same afterwards and everything
// local is already the account's. Signing in to an account that was
// made elsewhere is the other case: the id flips to a foreign one and
// the practice sitting in localStorage — exercise history, session
// history, Ascent days — belongs to an identity nobody is signed in as
// any more.
//
// It is still on the device and it comes back the moment they sign out.
// But nothing said so, so the honest reading was "signing in deleted my
// history", and that is the reading a singer will act on.
//
// Carrying it across is a server job (two identities, one of which may
// already hold conflicting rows) and is deliberately not built yet. So
// this says what happened, and offers a person to ask. A notice that
// tells the truth beats a merge that guesses.
//
// The predicate is pure so the "only once per account" rule is testable
// without a Storage or a signed-in session.

import { getDeviceId, getUserId } from '@/db/services/user-service'
import { pathProgress } from '@/features/path/path-progress'
import { CONTACT_EMAIL } from '@/lib/contact-links'
import { exerciseHistory } from '@/stores/exercise-history-store'
import { getSessionHistory } from '@/stores/practice-session-store'

const STORAGE_KEY = 'mercurypitch.localProgressNotice.v1'

export interface LocalProgress {
  exercises: number
  sessions: number
  ascentDays: number
}

export const EMPTY_PROGRESS: LocalProgress = {
  exercises: 0,
  sessions: 0,
  ascentDays: 0,
}

export function localProgressTotal(p: LocalProgress): number {
  return p.exercises + p.sessions + p.ascentDays
}

// ── The predicate ────────────────────────────────────────────────

export interface NoticeInputs {
  /** This browser's persisted id. '' when storage is blocked. */
  deviceId: string
  /** Who we are signed in as. Equals deviceId when signed out. */
  accountId: string
  /** Whether this account has already been told. */
  seen: boolean
  progress: LocalProgress
}

/**
 * Should the notice be shown? Pure.
 *
 * The signal is deviceId !== accountId: the device row was not the row
 * that became this account. Signed out the two are identical, so there
 * is nothing to check for a "signed in" flag separately.
 */
export function isNoticeDue(input: NoticeInputs): boolean {
  if (input.seen) return false
  if (input.deviceId === '' || input.accountId === '') return false
  if (input.deviceId === input.accountId) return false
  // Nothing was left behind, so there is nothing to explain.
  return localProgressTotal(input.progress) > 0
}

/**
 * What was left on the device, in words.
 *
 * Counts only things a person did on purpose. Melodies are excluded:
 * the library ships with seeded samples, so a non-empty one is not
 * evidence of anything and would fire this notice on a fresh install.
 */
export function describeLocalProgress(p: LocalProgress): string {
  const parts: string[] = []
  if (p.exercises > 0) {
    parts.push(`${p.exercises} exercise${p.exercises === 1 ? '' : 's'}`)
  }
  if (p.sessions > 0) {
    parts.push(`${p.sessions} practice session${p.sessions === 1 ? '' : 's'}`)
  }
  if (p.ascentDays > 0) {
    parts.push(
      `${p.ascentDays} day${p.ascentDays === 1 ? '' : 's'} of The Ascent`,
    )
  }
  if (parts.length === 0) return 'your practice so far'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * A mail draft the owner can act on: the two ids are the whole job.
 *
 * Composed into the singer's own mail client, which they read and send
 * themselves — nothing leaves the device until they press send.
 */
export function progressHandoffMailto(
  deviceId: string,
  accountId: string,
  p: LocalProgress,
): string {
  const subject = 'Move my practice history to my account'
  const body = [
    'Hi — I signed in and my earlier practice stayed on my old device identity.',
    '',
    `What is on the device: ${describeLocalProgress(p)}.`,
    '',
    'Please can you move it across?',
    '',
    '--- for MercuryPitch, please leave this in ---',
    `device: ${deviceId}`,
    `account: ${accountId}`,
  ].join('\n')
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ── Persistence ──────────────────────────────────────────────────

type SeenMap = Record<string, number>

function readSeen(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as SeenMap
  } catch {
    return {}
  }
}

/** Keyed per account: signing in to a SECOND account earns its own telling. */
export function noticeSeen(accountId: string): boolean {
  return readSeen()[accountId] !== undefined
}

export function markNoticeSeen(
  accountId = getUserId(),
  now = Date.now(),
): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readSeen(), [accountId]: now }),
    )
  } catch {
    // Blocked storage means the notice may repeat next sign-in. That is
    // the acceptable failure — the alternative is losing the dismissal
    // and showing an error about losing it.
  }
}

// ── Wiring ───────────────────────────────────────────────────────

/** What this device still holds, read synchronously from local stores. */
export function summarizeLocalProgress(): LocalProgress {
  const ascent = pathProgress()
  const ascentDays =
    ascent === null
      ? 0
      : Object.values(ascent.weekDays).reduce(
          (n, days) => n + (days?.length ?? 0),
          0,
        )
  return {
    exercises: exerciseHistory().length,
    sessions: getSessionHistory().length,
    ascentDays,
  }
}

export function localProgressNoticeDue(): boolean {
  const accountId = getUserId()
  return isNoticeDue({
    deviceId: getDeviceId(),
    accountId,
    seen: noticeSeen(accountId),
    progress: summarizeLocalProgress(),
  })
}
