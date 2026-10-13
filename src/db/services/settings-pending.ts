// ============================================================
// Settings pending — durable unsent writes retained separately per account
// ============================================================
import { storedTokenProvider } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'

/**
 * Local writes whose push has not landed on the account yet.
 *
 * In localStorage rather than memory, because the whole failure is a page
 * that goes away before its own debounced push fires: an in-memory ledger
 * dies with the tab that was about to upload it, which is precisely the
 * moment the record is needed.
 *
 * What it fixes: change the theme and reload inside PUSH_DEBOUNCE_MS and the
 * upload never happened, so the next pull found the account still holding the
 * OLD theme and `applyPersistedValue` wrote it back over the new one. The
 * visitor saw their choice revert for no stated reason. Reported 2026-09-10.
 *
 * Speed was never the fix. A shorter debounce only narrows the window, and
 * the same loss happens on a crash, a closed laptop, or an offline push —
 * so the pull has to know a local value is newer, not merely be raced to it.
 */
const PENDING_KEY = 'mp_sync_pending'

/**
 * Stamped with the identity that made the writes, and ignored under any
 * other. Logout does not clear localStorage (auth-service `logout`), so on a
 * shared computer one singer's unsent theme would otherwise be waiting when
 * the next one signs in — and the guard below would then defend it against
 * THEIR account and upload it there. Progress snapshots use the same account boundary.
 */
interface PendingLedger {
  owner: string
  values: Record<string, string>
  scopes?: Record<string, 'guest' | 'account'>
}

function pendingSlot(owner: string): string {
  return `${PENDING_KEY}:${encodeURIComponent(owner)}`
}

function storedLedger(): PendingLedger | null {
  const raw = localStorage.getItem(PENDING_KEY)
  return raw === null ? null : (JSON.parse(raw) as PendingLedger | null)
}

function readLedger(owner: string): PendingLedger {
  try {
    const active = storedLedger()
    if (active?.owner === owner) return active
    const raw = localStorage.getItem(pendingSlot(owner))
    if (raw !== null) {
      const saved = JSON.parse(raw) as PendingLedger | Record<string, string>
      if (saved.owner === owner && typeof saved.values === 'object')
        return saved as PendingLedger
      return { owner, values: saved as Record<string, string> }
    }
  } catch {
    // An unreadable ledger cannot supply an ownership claim.
  }
  return { owner, values: {} }
}

export function readPending(owner = getUserId()): Record<string, string> {
  return readLedger(owner).values ?? {}
}

export function readPendingEntry(
  key: string,
  owner: string,
): { value: string | undefined; scope: 'guest' | 'account' | undefined } {
  const ledger = readLedger(owner)
  return { value: ledger.values[key], scope: ledger.scopes?.[key] }
}

function writePending(ledger: PendingLedger): void {
  const { owner, values } = ledger
  const active = storedLedger()
  if (active !== null && active.owner !== owner) {
    localStorage.setItem(pendingSlot(active.owner), JSON.stringify(active))
  }
  if (Object.keys(values).length === 0) localStorage.removeItem(PENDING_KEY)
  else localStorage.setItem(PENDING_KEY, JSON.stringify(ledger))
  localStorage.removeItem(pendingSlot(owner))
}

export function markPending(
  key: string,
  value: string,
  owner = getUserId(),
): void {
  const ledger = readLedger(owner)
  ledger.values[key] = value
  ledger.scopes ??= {}
  // Value and provenance commit together. A failed write cannot label an
  // older same-device registered reset as a newly recorded guest reset.
  ledger.scopes[key] =
    storedTokenProvider() === 'anonymous' ? 'guest' : 'account'
  writePending(ledger)
}

export function clearPendingIfUnchanged(
  key: string,
  pushed: string,
  owner: string,
): void {
  const ledger = readLedger(owner)
  if (ledger.values[key] !== pushed) return
  delete ledger.values[key]
  if (ledger.scopes !== undefined) delete ledger.scopes[key]
  writePending(ledger)
}
