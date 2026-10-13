// ============================================================
// Echo's records: the best at each level, and the singer's root
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

import type { Signal } from 'solid-js'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import type { EchoBest, EchoBestTable } from '@/lib/sequence/echo-bests'
import { ECHO_BESTS_KEY, echoBeats, isEchoBestTable, } from '@/lib/sequence/echo-bests'
import type { EchoLevelId } from '@/lib/sequence/sequence-engine'
import { createPersistedSignal } from '@/lib/storage'

export type { EchoBest } from '@/lib/sequence/echo-bests'

/** Where the remembered root lives, and the settings row it syncs as. */
export const ECHO_ROOT_KEY = 'pitchperfect_echo_stars_root'

let table: Signal<EchoBestTable> | undefined
let root: Signal<number | null> | undefined

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

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetEchoStoreForTests(): void {
  table = undefined
  root = undefined
}
