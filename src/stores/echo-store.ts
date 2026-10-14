// ============================================================
// Echo's records: the best at each level, the singer's root, the demo seen
// ============================================================
//
// The live table of Echo's bests (its shape, its ordering and how a
// settings pull merges another device's copy are in
// src/lib/sequence/echo-bests.ts), and the root the singer settled on when
// there was no voiceprint, so the next run starts there without asking for
// a note again. Both follow the account (`pitchperfect_` keys, synced by
// settings-service.ts). The room records them; the Sing screen's card
// reads them. Built on first read, not on import, so nothing at this
// module's top level touches storage.
//
// Whether this device has seen the "how it works" demo is a device fact,
// not a preference: an `mp_` key, kept out of the settings sync, set the
// way the demo kit sets every room's (demo-kit/demo-seen.ts). It lives
// here, with the records it is read beside, so the Sing screen's picker can
// say the demo plays by itself without loading the room.

import type { Signal } from 'solid-js'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import type { EchoBest, EchoBestTable } from '@/lib/sequence/echo-bests'
import { ECHO_BESTS_KEY, echoBeats, isEchoBestTable, } from '@/lib/sequence/echo-bests'
import type { EchoLevelId } from '@/lib/sequence/sequence-engine'
import { ECHO_LEVELS } from '@/lib/sequence/sequence-engine'
import { createPersistedSignal } from '@/lib/storage'

export type { EchoBest } from '@/lib/sequence/echo-bests'

/** Where the remembered root lives, and the settings row it syncs as. */
export const ECHO_ROOT_KEY = 'pitchperfect_echo_stars_root'

/** Where the demo's seen flag lives: on this device only. */
export const ECHO_DEMO_SEEN_KEY = 'mp_echo_demo_seen'

let table: Signal<EchoBestTable> | undefined
let root: Signal<number | null> | undefined
let demoSeen: Signal<boolean> | undefined

function bests(): Signal<EchoBestTable> {
  table ??= createPersistedSignal<EchoBestTable>(
    ECHO_BESTS_KEY,
    {},
    {
      validator: isEchoBestTable,
    },
  )
  return table
}

function isRoot(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= HOLD_TARGET_MIN_MIDI &&
      value <= HOLD_TARGET_MAX_MIDI)
  )
}

function rootSignal(): Signal<number | null> {
  root ??= createPersistedSignal<number | null>(ECHO_ROOT_KEY, null, {
    validator: isRoot,
  })
  return root
}

/** The best at this level, or null before the first run there. */
export function echoBest(level: EchoLevelId): EchoBest | null {
  return bests()[0]()[level] ?? null
}

export interface EchoBestOutcome {
  /** The best before this run, or null for the first run at the level. */
  readonly previous: EchoBest | null
  /** This run beat a previous best (never true on a first run). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordEchoBest(
  level: EchoLevelId,
  run: EchoBest,
): EchoBestOutcome {
  const previous = echoBest(level)
  if (!echoBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

/** The root the singer settled on last, MIDI, or null. */
export function rememberedEchoRoot(): number | null {
  return rootSignal()[0]()
}

export function rememberEchoRoot(midi: number): void {
  if (isRoot(midi)) rootSignal()[1](midi)
}

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(ECHO_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function echoDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markEchoDemoSeen(): void {
  if (!echoDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run sung yet (no best at any level, no root kept). One rule for
 * the room (demo/useEchoDemo.ts) and the Sing screen's picker.
 */
export function echoDemoAutoPlays(): boolean {
  if (echoDemoSeen() || rememberedEchoRoot() !== null) return false
  const levels = Object.keys(ECHO_LEVELS) as EchoLevelId[]
  return levels.every((level) => echoBest(level) === null)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetEchoStoreForTests(): void {
  table = undefined
  root = undefined
  demoSeen = undefined
}
