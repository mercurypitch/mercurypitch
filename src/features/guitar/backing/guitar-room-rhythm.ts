// Guitar room rhythms describe tempo-free drum parts for the shared room clock.
// ============================================================

import type { DrumVoiceId } from '@/lib/drum-voices'

export interface GuitarRoomRhythmHit {
  /** Beat offset inside the repeating pattern; fractional offsets are allowed. */
  beatOffset: number
  voice: DrumVoiceId
  /** Normalized velocity passed to the current kit renderer. */
  velocity: number
}

/**
 * A semantic drum pattern with no clock or audio ownership.
 *
 * Today the room renders these voices with its lightweight synthesized kit.
 * A future soundbank can map the same voice identities to samples without
 * changing lesson, loop, or transport code.
 */
export interface GuitarRoomRhythmPreset {
  id: string
  label: string
  detail: string
  beatsPerPattern: number
  hits: readonly GuitarRoomRhythmHit[]
}

export const DEFAULT_GUITAR_ROOM_RHYTHM_PRESET_ID = 'first-win-rock'

export const GUITAR_ROOM_RHYTHM_PRESETS: readonly GuitarRoomRhythmPreset[] = [
  {
    id: DEFAULT_GUITAR_ROOM_RHYTHM_PRESET_ID,
    label: 'Straight',
    detail: 'A clear kick, snare, and closed-hat pulse.',
    beatsPerPattern: 4,
    hits: [
      { beatOffset: 0, voice: 'kick', velocity: 0.74 },
      { beatOffset: 0, voice: 'hh-closed', velocity: 0.46 },
      { beatOffset: 0.5, voice: 'hh-closed', velocity: 0.38 },
      { beatOffset: 1, voice: 'snare', velocity: 0.56 },
      { beatOffset: 1, voice: 'hh-closed', velocity: 0.46 },
      { beatOffset: 1.5, voice: 'hh-closed', velocity: 0.38 },
      { beatOffset: 2, voice: 'kick', velocity: 0.68 },
      { beatOffset: 2, voice: 'hh-closed', velocity: 0.46 },
      { beatOffset: 2.5, voice: 'hh-closed', velocity: 0.38 },
      { beatOffset: 3, voice: 'snare', velocity: 0.56 },
      { beatOffset: 3, voice: 'hh-closed', velocity: 0.46 },
      { beatOffset: 3.5, voice: 'hh-closed', velocity: 0.38 },
    ],
  },
  {
    id: 'first-win-pocket',
    label: 'Pocket',
    detail: 'A warmer backbeat with one gentle syncopated kick.',
    beatsPerPattern: 4,
    hits: [
      { beatOffset: 0, voice: 'kick', velocity: 0.72 },
      { beatOffset: 0, voice: 'hh-closed', velocity: 0.4 },
      { beatOffset: 0.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 1, voice: 'sidestick', velocity: 0.58 },
      { beatOffset: 1, voice: 'hh-closed', velocity: 0.4 },
      { beatOffset: 1.5, voice: 'kick', velocity: 0.48 },
      { beatOffset: 1.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 2, voice: 'kick', velocity: 0.64 },
      { beatOffset: 2, voice: 'hh-closed', velocity: 0.4 },
      { beatOffset: 2.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 3, voice: 'sidestick', velocity: 0.58 },
      { beatOffset: 3, voice: 'hh-closed', velocity: 0.4 },
      { beatOffset: 3.5, voice: 'hh-closed', velocity: 0.34 },
    ],
  },
  {
    id: 'first-win-lift',
    label: 'Lift',
    detail: 'A brighter hat pattern that opens into the next lap.',
    beatsPerPattern: 4,
    hits: [
      { beatOffset: 0, voice: 'kick', velocity: 0.72 },
      { beatOffset: 0, voice: 'hh-closed', velocity: 0.44 },
      { beatOffset: 0.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 1, voice: 'snare', velocity: 0.54 },
      { beatOffset: 1, voice: 'hh-closed', velocity: 0.44 },
      { beatOffset: 1.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 2, voice: 'kick', velocity: 0.66 },
      { beatOffset: 2, voice: 'hh-closed', velocity: 0.44 },
      { beatOffset: 2.5, voice: 'hh-closed', velocity: 0.34 },
      { beatOffset: 3, voice: 'snare', velocity: 0.54 },
      { beatOffset: 3, voice: 'hh-closed', velocity: 0.42 },
      { beatOffset: 3.5, voice: 'hh-open', velocity: 0.38 },
    ],
  },
]

const RHYTHM_PRESETS_BY_ID = new Map(
  GUITAR_ROOM_RHYTHM_PRESETS.map((preset) => [preset.id, preset] as const),
)

/** Resolve a local preset ID without ever interpreting it as an asset URL. */
export function resolveGuitarRoomRhythmPreset(
  presetId: string | null | undefined,
): GuitarRoomRhythmPreset {
  return (
    (presetId === null || presetId === undefined
      ? undefined
      : RHYTHM_PRESETS_BY_ID.get(presetId)) ??
    RHYTHM_PRESETS_BY_ID.get(DEFAULT_GUITAR_ROOM_RHYTHM_PRESET_ID) ??
    GUITAR_ROOM_RHYTHM_PRESETS[0]
  )
}

/** Return unique, known presets in configuration order with a safe fallback. */
export function resolveGuitarRoomRhythmPresets(
  presetIds: readonly string[],
): readonly GuitarRoomRhythmPreset[] {
  const seen = new Set<string>()
  const resolved: GuitarRoomRhythmPreset[] = []
  for (const id of presetIds) {
    const preset = RHYTHM_PRESETS_BY_ID.get(id)
    if (preset === undefined || seen.has(preset.id)) continue
    seen.add(preset.id)
    resolved.push(preset)
  }
  return resolved.length > 0 ? resolved : [resolveGuitarRoomRhythmPreset(null)]
}

/**
 * Choose another known beat without repeating the current one when possible.
 * Randomness is injected so runtime choice and tests use the same rule.
 */
export function nextGuitarRoomRhythmVariant(
  presetIds: readonly string[],
  currentPresetId: string,
  random: () => number = Math.random,
): GuitarRoomRhythmPreset {
  const candidates = resolveGuitarRoomRhythmPresets(presetIds)
  const alternatives = candidates.filter(
    (preset) => preset.id !== currentPresetId,
  )
  const pool = alternatives.length > 0 ? alternatives : candidates
  const draw = random()
  const normalized = Number.isFinite(draw)
    ? Math.min(0.999999, Math.max(0, draw))
    : 0
  return pool[Math.floor(normalized * pool.length)] ?? candidates[0]
}

/** Hits belonging to one authored beat, including their fractional offset. */
export function guitarRoomRhythmHitsForBeat(
  preset: GuitarRoomRhythmPreset,
  exerciseBeat: number,
): readonly GuitarRoomRhythmHit[] {
  const patternLength = Math.max(1, Math.floor(preset.beatsPerPattern))
  const patternBeat =
    ((Math.floor(exerciseBeat) % patternLength) + patternLength) % patternLength
  return preset.hits.filter((hit) => Math.floor(hit.beatOffset) === patternBeat)
}
