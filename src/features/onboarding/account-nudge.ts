// ============================================================
// Account nudges — asking at earned moments, and only then
// ============================================================
//
// Every ask follows something the singer just did: they made a
// voiceprint, they reached day two of a streak, they scored on a
// challenge. Nothing is ever locked behind one.
//
// A declined ask goes quiet for a week. The rule exists because the
// alternative — re-asking on every visit — is how a product teaches
// people to ignore it, and then to resent it.
//
// The predicate is pure so the quiet period is testable without
// mocking a clock or a Storage.

import { accountHeld } from '@/db/services/auth-service'

export const NUDGE_QUIET_DAYS = 7
const QUIET_MS = NUDGE_QUIET_DAYS * 24 * 60 * 60 * 1000

const STORAGE_KEY = 'mercurypitch.accountNudges.v1'

/** Each is a moment where the singer has just made something. */
export type NudgeId =
  /** Beat 7 — the twin, right after the voiceprint. */
  | 'onboarding-twin'
  /** Two days in a row; the streak is now worth protecting. */
  | 'streak-day-2'
  /** A ranked score exists and could be held. */
  | 'first-challenge'

export interface NudgeState {
  /** Epoch ms of the last dismissal, or null if never dismissed. */
  dismissedAt: number | null
  /** True once an account exists — the ask is retired for good. */
  satisfied: boolean
}

/**
 * Should this nudge be shown? Pure: pass the stored state and the
 * current time.
 */
export function isNudgeDue(state: NudgeState, now: number): boolean {
  if (state.satisfied) return false
  if (state.dismissedAt === null) return true
  return now - state.dismissedAt >= QUIET_MS
}

// ── Persistence ──────────────────────────────────────────────────

type StoredNudges = Partial<Record<NudgeId, NudgeState>>

function readAll(): StoredNudges {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as StoredNudges
  } catch {
    return {}
  }
}

function writeAll(next: StoredNudges): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage means the nudge may reappear next visit. That is
    // the acceptable failure — the alternative is losing the dismissal
    // AND showing an error about it.
  }
}

export function nudgeState(id: NudgeId): NudgeState {
  return readAll()[id] ?? { dismissedAt: null, satisfied: false }
}

/**
 * Whether to show a given nudge right now.
 *
 * An account that already exists silences every ask — checked here
 * rather than at each call site, because the one that forgot is exactly
 * the one that shipped: the streak card offered "Create a free account"
 * to a signed-in singer, and the button took them to a settings page
 * that had nothing to do.
 *
 * accountHeld() is synchronous and reactive, so this is right on the
 * first render and corrects itself on sign-in.
 */
export function shouldShowNudge(id: NudgeId, now = Date.now()): boolean {
  if (accountHeld()) return false
  return isNudgeDue(nudgeState(id), now)
}

export function dismissNudge(id: NudgeId, now = Date.now()): void {
  const all = readAll()
  writeAll({ ...all, [id]: { ...nudgeState(id), dismissedAt: now } })
}

/** Retire a nudge permanently — the account it asked for now exists. */
export function satisfyNudge(id: NudgeId): void {
  const all = readAll()
  writeAll({ ...all, [id]: { ...nudgeState(id), satisfied: true } })
}

/** Retire every nudge at once, for when an account is created. */
export function satisfyAllNudges(): void {
  const ids: NudgeId[] = ['onboarding-twin', 'streak-day-2', 'first-challenge']
  const all = readAll()
  const next: StoredNudges = { ...all }
  for (const id of ids) {
    next[id] = { ...(all[id] ?? { dismissedAt: null }), satisfied: true }
  }
  writeAll(next)
}
