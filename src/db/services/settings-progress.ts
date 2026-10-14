// ============================================================
// Settings progress — account-owned local copies and their active projection
// ============================================================
// One atomic envelope per merge key preserves the outgoing account before
// the visible persisted signal switches, including guest adoption and expiry.

import { currentAccountId, isRegisteredProvider, storedTokenProvider, } from '@/db/services/auth-service'
import { getDeviceId, getUserId } from '@/db/services/user-service'
import type { PathProgress } from '@/features/path/path-progress'
import { mergePathProgress, PATH_PROGRESS_KEY, } from '@/features/path/path-progress'
import { LONG_NOTE_BESTS_KEY, mergeBestsOnPull } from '@/lib/hold/hold-bests'
import { mergeNgBestsOnPull, NG_BESTS_KEY } from '@/lib/glide/ng-bests'
import { PREMIUM_EXERCISES } from '@/lib/native-build'
import { ECHO_BESTS_KEY, mergeEchoBestsOnPull } from '@/lib/sequence/echo-bests'
import { applyPersistedValue } from '@/lib/storage'
import { readPending, readPendingEntry } from './settings-pending'

/**
 * Keys whose two sides must be reconciled, not overwritten, when a
 * sign-in finds a value on both the device and the account.
 *
 * Everything else is a preference — last one wins is right, and the newest
 * device is the best guess. Progress is not a preference: overwriting it
 * destroys practice days someone actually did. Each resolver takes the raw
 * strings and returns the value both sides should end up holding.
 */
export const MERGE_ON_PULL: Record<
  string,
  (local: string | null, cloud: string) => string
> = {
  [PATH_PROGRESS_KEY]: (local, cloud) => {
    if (local === null) return cloud
    try {
      const merged = mergePathProgress(
        JSON.parse(local) as PathProgress | null,
        JSON.parse(cloud) as PathProgress | null,
      )
      return JSON.stringify(merged)
    } catch {
      // Unparseable on either side — prefer the account's copy over a
      // corrupt local one rather than dropping the pull entirely.
      return cloud
    }
  },
}

// The premium exercises' bests are records too: a pull keeps the better
// best on each note (Long note, hold-bests.ts) and at each level (Echo,
// echo-bests.ts; Ng slides, ng-bests.ts), not the newest device's table. Named only in a build
// with the premium exercises; a store build folds the keys and the merges
// away.
if (PREMIUM_EXERCISES) {
  MERGE_ON_PULL[LONG_NOTE_BESTS_KEY] = mergeBestsOnPull
  MERGE_ON_PULL[ECHO_BESTS_KEY] = mergeEchoBestsOnPull
  MERGE_ON_PULL[NG_BESTS_KEY] = mergeNgBestsOnPull
}

/** Legacy owner stamps are read once when migrating each progress key. */
const MERGE_OWNER_KEY = 'mp_sync_owner'
const PROGRESS_COPIES_PREFIX = 'mp_sync_progress:'
export const MERGE_DEFAULTS: Record<string, string> = {
  [PATH_PROGRESS_KEY]: 'null',
}
if (PREMIUM_EXERCISES) {
  MERGE_DEFAULTS[LONG_NOTE_BESTS_KEY] = '{}'
  MERGE_DEFAULTS[ECHO_BESTS_KEY] = '{}'
  MERGE_DEFAULTS[NG_BESTS_KEY] = '{}'
}

interface ResetIntent {
  id: string
  pending: boolean
}

interface ProgressCopies {
  owner: string | null
  values: Record<string, string>
  resets?: Record<string, ResetIntent>
  guestWritten?: boolean
}

// One atomic envelope per key is authoritative. The ordinary preference key
// remains the live-store projection, but a failed projection write or a crash
// between writes cannot turn a foreign account's copy into unowned progress.
const progressViews = new Map<
  string,
  { owner: string | null; value: string; resetId?: string }
>()
const unsavedProgress = new Map<
  string,
  {
    owner: string | null
    value: string
    reset?: ResetIntent
    guestWritten?: boolean
  }
>()
const reconciledWrites = new Map<string, string>()

function progressOwner(): string | null {
  // An expired registered token is still A's local work. Only an actual
  // sign-out switches to guest; hasUpgradedAccount() also tests expiry.
  return isRegisteredProvider(storedTokenProvider()) ? currentAccountId() : null
}

function ownerSlot(owner: string | null): string {
  return owner === null ? 'guest' : `account:${owner}`
}

function readStoredCopies(key: string): ProgressCopies {
  const raw = localStorage.getItem(`${PROGRESS_COPIES_PREFIX}${key}`)
  if (raw !== null) {
    const parsed = JSON.parse(raw) as ProgressCopies
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed.owner !== null && typeof parsed.owner !== 'string') ||
      parsed.values === null ||
      typeof parsed.values !== 'object' ||
      Array.isArray(parsed.values) ||
      Object.values(parsed.values).some((value) => typeof value !== 'string') ||
      (parsed.guestWritten !== undefined &&
        typeof parsed.guestWritten !== 'boolean')
    )
      throw new Error('Invalid saved progress ownership')
    if (
      parsed.resets !== undefined &&
      (parsed.resets === null ||
        typeof parsed.resets !== 'object' ||
        Array.isArray(parsed.resets) ||
        Object.values(parsed.resets).some(
          (reset) =>
            reset === null ||
            typeof reset !== 'object' ||
            typeof reset.id !== 'string' ||
            typeof reset.pending !== 'boolean',
        ))
    )
      throw new Error('Invalid saved progress reset')
    return parsed
  }
  let owner =
    localStorage.getItem(`${MERGE_OWNER_KEY}:${key}`) ??
    localStorage.getItem(MERGE_OWNER_KEY)
  // Old anonymous sessions stamped the device id. Do not mistake an account
  // upgraded in place (whose id is also the device id) for that guest.
  if (owner === getDeviceId() && storedTokenProvider() === 'anonymous')
    owner = null
  const value = localStorage.getItem(key)
  const currentOwner = progressOwner()
  // On sign-out getUserId can still equal an upgraded-in-place account's
  // device ID. Its registered pending ledger must never become guest data.
  const pending =
    currentOwner === null ? undefined : readPending(getUserId())[key]
  // Older builds could leave A's stamp on a later B write. B's durable
  // pending ledger is stronger ownership evidence than that stale stamp.
  // This preserves recorded work; already mixed history from those builds
  // cannot be separated into its original singers after the fact.
  if (
    pending !== undefined &&
    (pending === value || (owner === null && isProgressReset(key, pending)))
  )
    owner = currentOwner
  return { owner, values: value === null ? {} : { [ownerSlot(owner)]: value } }
}

function readProgressCopies(key: string): ProgressCopies {
  const copies = readStoredCopies(key)
  const unsaved = unsavedProgress.get(key)
  if (unsaved !== undefined) {
    copies.values[ownerSlot(unsaved.owner)] = unsaved.value
    if (unsaved.guestWritten === true) copies.guestWritten = true
    if (unsaved.reset !== undefined) {
      copies.resets ??= {}
      copies.resets[ownerSlot(unsaved.owner)] = unsaved.reset
    }
  }
  return copies
}

function projectProgress(key: string, copies: ProgressCopies): void {
  const value = copies.values[ownerSlot(copies.owner)] ?? MERGE_DEFAULTS[key]
  // Store the ownership and every saved copy before changing the live view.
  // A failed write throws and prevents any upload; the previous envelope is
  // still complete. A failed projection is retried from this envelope later.
  localStorage.setItem(
    `${PROGRESS_COPIES_PREFIX}${key}`,
    JSON.stringify(copies),
  )
  unsavedProgress.delete(key)
  localStorage.setItem(key, value)
  applyPersistedValue(key, value)
  progressViews.set(key, {
    owner: copies.owner,
    value,
    resetId: copies.resets?.[ownerSlot(copies.owner)]?.id,
  })
}

function reconcileOwnerPending(
  key: string,
  copies: ProgressCopies,
  owner: string | null,
): void {
  const anonymous = owner === null && storedTokenProvider() === 'anonymous'
  if (owner === null && !anonymous) return
  const slot = ownerSlot(owner)
  // A guest boot may create the envelope before the registered pending
  // ledger becomes visible. Preserve those writes on registered activation.
  // After any known reset, an unversioned old ledger cannot resurrect its
  // earlier climb; new writes already save their snapshot before the ledger.
  if (copies.resets?.[slot] !== undefined) return
  // The request ID can stay the same during an anonymous account upgrade.
  // Only the ledger's atomic provenance identifies which side wrote it.
  const actor = owner ?? getUserId()
  const { value: pending, scope } = readPendingEntry(key, actor)
  if (
    (owner !== null && scope === 'guest') ||
    (anonymous && scope === 'account')
  )
    return
  if (pending === undefined) return
  if (anonymous) {
    copies.guestWritten = true
  }
  if (isProgressReset(key, pending)) {
    copies.values[slot] = pending
    copies.resets ??= {}
    copies.resets[slot] = newResetIntent()
    // A legacy reset supersedes the unowned raw value too. An established
    // reset returned above, so genuinely later guest practice still adopts.
    if (owner !== null && copies.owner === null && copies.guestWritten !== true)
      delete copies.values.guest
  } else if (copies.values[slot] !== pending) {
    copies.values[slot] = MERGE_ON_PULL[key](
      copies.values[slot] ?? null,
      pending,
    )
  }
}

export function activateProgressKey(key: string): boolean {
  const copies = readProgressCopies(key)
  const previousOwner = copies.owner
  const owner = progressOwner()
  reconcileOwnerPending(key, copies, owner)
  if (copies.owner === null && owner !== null) {
    // Guest practice follows the person making/signing into an account once.
    // Remove the guest slot so a later sign-out cannot adopt it a second time.
    const guest = copies.values.guest
    if (guest !== undefined) {
      const own = copies.values[ownerSlot(owner)]
      copies.values[ownerSlot(owner)] =
        own === undefined ? guest : MERGE_ON_PULL[key](guest, own)
      delete copies.values.guest
    }
    // A guest reset replaces only that guest's cloud climb. Signing into an
    // existing account adopts practice, never a command to erase its climb.
    if (copies.resets !== undefined) delete copies.resets.guest
    delete copies.guestWritten
  }
  copies.owner = owner
  const value = copies.values[ownerSlot(owner)] ?? MERGE_DEFAULTS[key]
  const previous = progressViews.get(key)
  const changed =
    previous === undefined ||
    previous.owner !== owner ||
    previous.value !== value ||
    previous.resetId !== copies.resets?.[ownerSlot(owner)]?.id
  if (
    changed ||
    previousOwner !== owner ||
    unsavedProgress.has(key) ||
    localStorage.getItem(`${PROGRESS_COPIES_PREFIX}${key}`) === null ||
    localStorage.getItem(key) !== value
  ) {
    try {
      projectProgress(key, copies)
    } catch (err) {
      // Even at quota exhaustion, hide the outgoing singer's live view.
      // Durable copies remain untouched and the caller refuses the write.
      applyPersistedValue(key, value, { persist: false })
      throw err
    }
  }
  return previous === undefined || previous.owner !== owner
}

export function activateProgress(): boolean {
  let activated = true
  for (const key of Object.keys(MERGE_ON_PULL)) {
    try {
      activateProgressKey(key)
    } catch (err) {
      activated = false
      console.warn('[settings-sync] could not switch local progress:', err)
    }
  }
  return activated
}

export function progressValue(key: string): string | undefined {
  const copies = readProgressCopies(key)
  if (copies.owner !== progressOwner())
    throw new Error('Progress owner changed')
  return copies.values[ownerSlot(copies.owner)]
}

export function saveProgress(
  key: string,
  value: string,
  reset?: ResetIntent,
  localWrite = false,
): void {
  const copies = readProgressCopies(key)
  if (copies.owner !== progressOwner())
    throw new Error('Progress owner changed')
  const slot = ownerSlot(copies.owner)
  copies.values[slot] = value
  if (localWrite && copies.owner === null) {
    copies.guestWritten = true
  }
  if (reset !== undefined) {
    copies.resets ??= {}
    copies.resets[slot] = reset
  }
  // The persisted-signal setter has already accepted this practice. Keep it
  // in this tab even if the browser refuses the durable snapshot; activation
  // retries that snapshot before allowing an account switch or an upload.
  unsavedProgress.set(key, {
    owner: copies.owner,
    value,
    reset: copies.resets?.[slot],
    guestWritten: copies.guestWritten,
  })
  projectProgress(key, copies)
}

/** Reconcile before a setter; refuse stale actions across a singer or reset change. */
export function beforeProgressWrite(key: string): boolean {
  reconciledWrites.delete(key)
  const previous = progressViews.get(key)
  if (activateProgressKey(key)) return false
  const current = progressViews.get(key)
  // Another tab reset the climb after this action read the old value. Its
  // absolute result must not put that previous climb back into the new one.
  if (previous?.resetId !== current?.resetId) return false
  if (
    previous !== undefined &&
    current !== undefined &&
    previous.value !== current.value
  ) {
    // An absolute setter may have used the old same-account view. Retain the
    // other tab's progress as well; functional setters see the hydrated view.
    reconciledWrites.set(key, current.value)
  }
  return true
}

export function saveLocalProgress(key: string, value: string): string {
  const concurrent = reconciledWrites.get(key)
  reconciledWrites.delete(key)
  const resetting = isProgressReset(key, value)
  const next =
    concurrent === undefined || resetting
      ? value
      : MERGE_ON_PULL[key](value, concurrent)
  const reset = resetting ? newResetIntent() : undefined
  saveProgress(key, next, reset, true)
  return next
}

/** An explicit reset replaces this owner's previous climb until acknowledged. */
export function isProgressReset(key: string, value: string): boolean {
  return key === PATH_PROGRESS_KEY && value === 'null'
}

function newResetIntent(): ResetIntent {
  return { id: window.crypto.randomUUID(), pending: true }
}

function activeReset(key: string): ResetIntent | undefined {
  if (key !== PATH_PROGRESS_KEY) return undefined
  const copies = readProgressCopies(key)
  if (copies.owner !== progressOwner())
    throw new Error('Progress owner changed')
  return copies.resets?.[ownerSlot(copies.owner)]
}

export function progressReset(key: string): string | undefined {
  const reset = activeReset(key)
  return reset?.pending === true ? reset.id : undefined
}

/** Retain the acknowledged generation so a delayed pull cannot undo a reset. */
export function progressResetRevision(): string | undefined {
  return JSON.stringify(activeReset(PATH_PROGRESS_KEY))
}

export function acknowledgeProgressReset(
  key: string,
  id: string | undefined,
): void {
  if (id === undefined) return
  const copies = readProgressCopies(key)
  if (copies.owner !== progressOwner())
    throw new Error('Progress owner changed')
  const reset = copies.resets?.[ownerSlot(copies.owner)]
  if (reset?.id !== id || !reset.pending) return
  copies.resets![ownerSlot(copies.owner)] = { ...reset, pending: false }
  // Acknowledgement changes metadata only; do not re-apply a live signal or
  // risk the separate projection write after the durable revision changed.
  localStorage.setItem(
    `${PROGRESS_COPIES_PREFIX}${key}`,
    JSON.stringify(copies),
  )
  unsavedProgress.delete(key)
}
