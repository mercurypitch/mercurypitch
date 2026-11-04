// ============================================================
// TV memory: what each TV shows when it connects, kept on this phone
// ============================================================
//
// The TV chooser (tv-choice.ts) asks once what a TV should show, and keeps
// the answer here while "Remember for ..." stays ticked: the stage, the
// lyrics, or the plain mirror of the phone. Settings, Karaoke, TV lists what
// is kept, changes it and forgets it (TvSettingsGroup.tsx).
//
// KEYED BY THE TV'S NAME, as the sound's route names its port on AirPlay or
// HDMI ("LG webOS TV OLED48C24LA", tv-name.ts). A TV whose name never came
// is kept under one key for every such TV, name null: "this TV" to the
// sheet, and the phone may never hear a name at all (an iPhone 13 Pro's
// session reported the speaker throughout, MISTAKES.md).
//
// THIS PHONE'S: an `mp:` key, which the settings sync never pushes (it syncs
// `pitchperfect_` keys, settings-service.ts). A TV's name can name a person
// ("Viki's TV"), and the TVs around one phone are not another phone's.
// Built on first read, not at import, as the onboarding flag is: storage is
// read after the native storage port has hydrated, and an importer that
// never asks pays nothing.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

/** What a TV shows: the room's stage, its lyrics, or a mirror of the phone. */
export type TvChoice = 'stage' | 'lyrics' | 'mirror'

/** In the order they are offered. */
export const TV_CHOICES: readonly TvChoice[] = ['stage', 'lyrics', 'mirror']

/** One TV this phone remembers, and what it shows. */
export interface RememberedTv {
  /** Its name, or null for a TV whose name never came. */
  readonly name: string | null
  readonly choice: TvChoice
}

export const TV_MEMORY_KEY = 'mp:tv-choices'

const isChoice = (value: unknown): value is TvChoice =>
  value === 'stage' || value === 'lyrics' || value === 'mirror'

function isRemembered(value: unknown): value is RememberedTv {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  const name = entry.name
  const named = name === null || (typeof name === 'string' && name !== '')
  return named && isChoice(entry.choice)
}

/** A list of TVs, each name once: anything else reads as none kept. */
function isMemory(value: unknown): value is RememberedTv[] {
  if (!Array.isArray(value) || !value.every(isRemembered)) return false
  const names = value.map((tv: RememberedTv) => tv.name)
  return new Set(names).size === names.length
}

let memory: Signal<RememberedTv[]> | undefined

const resolve = (): Signal<RememberedTv[]> => {
  memory ??= createPersistedSignal<RememberedTv[]>(TV_MEMORY_KEY, [], {
    validator: isMemory,
  })
  return memory
}

/** Every TV this phone remembers, in the order each was first kept. */
export function rememberedTvs(): readonly RememberedTv[] {
  return resolve()[0]()
}

/** What this TV shows when it connects, or null where none is kept. */
export function rememberedChoice(name: string | null): TvChoice | null {
  return rememberedTvs().find((tv) => tv.name === name)?.choice ?? null
}

/** Keep what this TV shows: a new TV goes last, a known one keeps its place. */
export function rememberTv(name: string | null, choice: TvChoice): void {
  resolve()[1]((kept) => {
    if (!kept.some((tv) => tv.name === name)) return [...kept, { name, choice }]
    return kept.map((tv) => (tv.name === name ? { name, choice } : tv))
  })
}

/** Forget this TV: the next time it connects, the phone asks again. */
export function forgetTv(name: string | null): void {
  resolve()[1]((kept) => kept.filter((tv) => tv.name !== name))
}

/** Tests: read storage afresh on the next call, as a new launch would. */
export function reloadTvMemoryForTests(): void {
  memory = undefined
}
