// ============================================================
// First value — the first real result a device gets in each room
// ============================================================
//
// One `first_value_<room>` event per room, sent the first time this device
// gets a real result there (a saved run, a first Karaoke score, a finished
// drill, song or take). It answers "did a new visitor get anything out of the
// room" without a second event for every screen along the way.
//
// Once per device, not once per account: the record is a localStorage key that
// settings sync never carries (it syncs only `pitchperfect_` keys, see
// src/db/services/settings-service.ts), so a second device counts its own
// first. An in-memory set backs the stored map, so storage that throws (a
// private window, a blocked profile) still yields one send per page instead of
// one per result.
//
// Web only: a native build sends none. Never throws: it sits beside a session
// save and a scoring callback, and neither may fail because of telemetry.
// ============================================================

import type { SessionSource } from '@/db/entities'
import { trackGuide } from '@/lib/guide-funnel'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

export type FirstValueKind =
  | 'sing'
  | 'karaoke'
  | 'drill'
  | 'ear'
  | 'guitar'
  | 'piano'

/** Holds `{ [kind]: ISO time }`. Device-local: settings sync skips it. */
export const FIRST_VALUE_KEY = 'mp.first_value.v1'

const sentThisPage = new Set<FirstValueKind>()

function readStored(): Partial<Record<FirstValueKind, string>> {
  try {
    const raw = localStorage.getItem(FIRST_VALUE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Partial<Record<FirstValueKind, string>>
  } catch {
    return {}
  }
}

/** Whether this device already has its first value in `kind`'s room. */
export function firstValueSeen(kind: FirstValueKind): boolean {
  return sentThisPage.has(kind) || readStored()[kind] !== undefined
}

/**
 * Send the first-value event for `kind` unless this device already has.
 * Returns whether it sent. `native` defaults to the build, so a native build
 * sends nothing and records nothing.
 */
export function trackFirstValue(
  kind: FirstValueKind,
  opts: { native?: boolean } = {},
): boolean {
  try {
    if (opts.native ?? IS_NATIVE_BUILD) return false
    if (firstValueSeen(kind)) return false
    sentThisPage.add(kind)
    trackGuide(`first_value_${kind}`)
    try {
      localStorage.setItem(
        FIRST_VALUE_KEY,
        JSON.stringify({ ...readStored(), [kind]: new Date().toISOString() }),
      )
    } catch {
      // The in-memory set still holds this page to one send.
    }
    return true
  } catch {
    return false
  }
}

/**
 * The room a saved run belongs to: the drills are their own room. A challenge
 * or weekly record is only written for an exercise run it claimed (see
 * src/stores/exercise-history-store.ts), so those are drills too.
 */
export function firstValueForSession(source: SessionSource): FirstValueKind {
  switch (source) {
    case 'exercise':
    case 'challenge':
    case 'weekly':
      return 'drill'
    case 'practice':
      return 'sing'
    default: {
      // A new SessionSource fails to compile here until it picks a room.
      const unmapped: never = source
      return unmapped
    }
  }
}

/** Give a test a clean device: forget this page's sends and the stored map. */
export function resetFirstValueForTests(): void {
  sentThisPage.clear()
  try {
    localStorage.removeItem(FIRST_VALUE_KEY)
  } catch {
    // Storage that throws holds nothing to clear.
  }
}
