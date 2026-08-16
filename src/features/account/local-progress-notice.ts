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
// One exception, and it is not visible here: the Ascent DOES cross over,
// because settings sync unions it whenever the device's copy was made
// signed out (settings-service.ts, MERGE_OWNER_KEY). The counts below
// still name it — the days are on the device either way — but the copy
// deliberately does not say the Ascent stayed behind.
//
// The predicate is pure so the "only once per account" rule is testable
// without a Storage or a signed-in session.

import { getDeviceId, getUserId } from '@/db/services/user-service'
import { ENDOWED_DAY, pathProgress } from '@/features/path/path-progress'
import { CONTACT_EMAIL } from '@/lib/contact-links'
import { localDayString } from '@/lib/local-day'
import { storageGet, storageSet } from '@/lib/storage'
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

/**
 * When this device first saw each account — the line between "practice that
 * was here before you signed in" and "practice you have done since".
 *
 * The local stores are one device-wide list each, with no idea who was signed
 * in when a row was written. So a run finished AFTER signing in landed in the
 * same list the notice counts, the notice became due mid-practice, and a modal
 * about lost history opened over the drill result the singer was reading —
 * including, at 390x844, over the "Stay here" button the countdown tells them
 * to press. The cutoff is what makes "earlier" mean earlier.
 */
const FIRST_SEEN_KEY = 'mercurypitch.localProgressNotice.firstSeen.v1'

function readSeen(): SeenMap {
  // storageGet hands back the RAW STRING when the value will not parse, so
  // the shape still has to be checked here — spreading a string into the
  // next write would persist one key per character.
  const raw = storageGet<unknown>(STORAGE_KEY)
  if (typeof raw !== 'object' || raw === null) return {}
  return raw as SeenMap
}

/** Keyed per account: signing in to a SECOND account earns its own telling. */
export function noticeSeen(accountId: string): boolean {
  return readSeen()[accountId] !== undefined
}

/**
 * Blocked storage means the notice may repeat next sign-in — storageSet
 * warns and moves on. That is the acceptable failure; the alternative is
 * losing the dismissal AND showing an error about losing it.
 */
export function markNoticeSeen(
  accountId = getUserId(),
  now = Date.now(),
): void {
  storageSet(STORAGE_KEY, { ...readSeen(), [accountId]: now })
}

function readFirstSeen(): SeenMap {
  const raw = storageGet<unknown>(FIRST_SEEN_KEY)
  if (typeof raw !== 'object' || raw === null) return {}
  return raw as SeenMap
}

/**
 * When this device first saw `accountId`, stamping now if it never has.
 *
 * Called on the first render after a sign-in, so "now" is within a second or
 * two of the sign-in itself — close enough to divide a history whose rows are
 * minutes and days apart. Blocked storage means no stamp sticks and the
 * cutoff is this moment every time, which is the same reading, just
 * recomputed.
 */
export function accountFirstSeenAt(
  accountId: string,
  now = Date.now(),
): number {
  const stored = readFirstSeen()
  const seen = stored[accountId]
  if (typeof seen === 'number' && Number.isFinite(seen)) return seen
  storageSet(FIRST_SEEN_KEY, { ...stored, [accountId]: now })
  return now
}

// ── Wiring ───────────────────────────────────────────────────────

/**
 * What this device held before `before`, read synchronously from local stores.
 *
 * Rows carry `completedAt` in epoch milliseconds and Ascent days are
 * `YYYY-MM-DD`, so both compare directly against the cutoff. The Ascent's
 * seeded `ENDOWED_DAY` is not a date and is not a day anybody practised, so it
 * counts as nothing here — otherwise merely opening The Ascent after signing
 * in would raise a notice about practice that never happened.
 */
export function summarizeLocalProgress(
  before: number = Number.POSITIVE_INFINITY,
): LocalProgress {
  const ascent = pathProgress()
  const cutoffDay = Number.isFinite(before)
    ? localDayString(new Date(before))
    : null
  const ascentDays =
    ascent === null
      ? 0
      : Object.values(ascent.weekDays).reduce(
          (n, days) =>
            n +
            (days ?? []).filter((day) => {
              if (day === ENDOWED_DAY) return false
              return cutoffDay === null || day < cutoffDay
            }).length,
          0,
        )
  return {
    exercises: exerciseHistory().filter((e) => e.completedAt < before).length,
    sessions: getSessionHistory().filter((s) => s.completedAt < before).length,
    ascentDays,
  }
}

/** What was on the device when this account signed in here. */
export function localProgressAtSignIn(accountId = getUserId()): LocalProgress {
  return summarizeLocalProgress(accountFirstSeenAt(accountId))
}

export function localProgressNoticeDue(): boolean {
  const accountId = getUserId()
  const deviceId = getDeviceId()
  // Checked before the stamp so that being signed out — where the two ids are
  // the same — never writes one, and signing in later still divides the
  // history at the moment it happened.
  if (deviceId === '' || accountId === '' || deviceId === accountId) {
    return false
  }
  return isNoticeDue({
    deviceId,
    accountId,
    seen: noticeSeen(accountId),
    progress: localProgressAtSignIn(accountId),
  })
}
