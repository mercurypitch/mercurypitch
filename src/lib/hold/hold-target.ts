// ============================================================
// Hold target — which note the Long note asks for
// ============================================================
//
// First choice is the singer's latest voiceprint: 35 % of the way up its
// practice range (practiceRange, below), a note low enough to hold for a
// long time, rounded to the nearest natural (white-key) note so it has a
// plain name. Without a
// usable voiceprint, the voice-type preset's anchor; native users have no
// voice-type picker, so that is tenor. `source` tells the room which one it
// got, so it can offer the "sing any easy note" pre-roll instead.
//
// Pure: the voiceprints and the preset come in as arguments. The thin loader
// that reads them from the device is `load-hold-target.ts`.

import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { getComfortableMidiRange } from '@/lib/vocal-range'

/** A voice type. Spelled via vocal-range so lib does not import a store. */
export type HoldVoicePreset = Parameters<typeof getComfortableMidiRange>[0]

export type HoldTargetSource = 'voiceprint' | 'preset'

export interface HoldTarget {
  midi: number
  source: HoldTargetSource
}

/** Where in the voiceprint's span the target sits, from the bottom. */
export const HOLD_TARGET_SPAN_FRACTION = 0.35

/** Voice type for anyone who never chose one (every native user). */
export const HOLD_DEFAULT_PRESET: HoldVoicePreset = 'tenor'

/** The union of every voice type's range: bass's E2 to soprano's C6. */
export const HOLD_TARGET_MIN_MIDI = getComfortableMidiRange('bass').min
export const HOLD_TARGET_MAX_MIDI = getComfortableMidiRange('soprano').max

const NATURAL_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11])

const isNatural = (midi: number): boolean =>
  NATURAL_PITCH_CLASSES.has(((midi % 12) + 12) % 12)

const clampMidi = (midi: number): number =>
  Math.max(HOLD_TARGET_MIN_MIDI, Math.min(HOLD_TARGET_MAX_MIDI, midi))

/** The natural note nearest a fractional MIDI value; a tie goes lower. */
export function nearestNaturalMidi(value: number): number {
  const below = Math.floor(value)
  let down = below
  while (!isNatural(down)) down -= 1
  let up = below + 1
  while (!isNatural(up)) up += 1
  return value - down <= up - value ? down : up
}

/** A voiceprint's measured range, MIDI. */
export interface VoiceprintRange {
  low: number
  high: number
}

function voiceprintRange(record: VoiceprintRecord): VoiceprintRange | null {
  const { lowMidi, highMidi } = record.summary
  if (
    typeof lowMidi !== 'number' ||
    typeof highMidi !== 'number' ||
    !Number.isFinite(lowMidi) ||
    !Number.isFinite(highMidi) ||
    highMidi < lowMidi
  ) {
    return null
  }
  return { low: lowMidi, high: highMidi }
}

/**
 * The range of the newest voiceprint that measured one; older takes and
 * takes whose range failed to measure are ignored. Null when none did.
 * The one rule the exercises read the singer's range by (through
 * latestPracticeRange), so they never read different takes.
 */
export function latestVoiceprintRange(
  voiceprints: readonly VoiceprintRecord[],
): VoiceprintRange | null {
  let latest: { range: VoiceprintRange; takenAt: string } | null = null
  for (const record of voiceprints) {
    const range = voiceprintRange(record)
    if (range === null) continue
    if (latest === null || record.takenAt > latest.takenAt) {
      latest = { range, takenAt: record.takenAt }
    }
  }
  return latest === null ? null : latest.range
}

/**
 * The most of a measured range the exercises are placed in: two octaves.
 * A range's ends are its least sure notes. Sliding as low as feels easy
 * often ends in a growl or a creak, which no exercise can use: counted up
 * from such an end, a near-tenor's Lip roll began on an A2 he could not
 * hold (owner, November 2026). Sliding up often flips into falsetto, or the
 * tracker slips an octave, though a lip roll or a siren may well climb
 * into falsetto. So past two octaves the excess comes off both ends, two
 * parts from the bottom to one from the top (PRACTICE_TRIM_FROM_LOW): a
 * falsetto top lifts the exercises by two thirds of itself, not all of it.
 * A range of two octaves or less is used whole.
 */
export const PRACTICE_SPAN_SEMITONES = 24

/** The share of a range's excess over two octaves taken off its bottom. */
export const PRACTICE_TRIM_FROM_LOW = 2 / 3

/** A measured range as the exercises use it (PRACTICE_SPAN_SEMITONES). */
export function practiceRange(range: VoiceprintRange): VoiceprintRange {
  const excess = range.high - range.low - PRACTICE_SPAN_SEMITONES
  if (!(excess > 0)) return range
  const low = range.low + excess * PRACTICE_TRIM_FROM_LOW
  return { low, high: low + PRACTICE_SPAN_SEMITONES }
}

/**
 * The newest voiceprint's range as the exercises use it: Long note, Echo,
 * Lip roll and Ng slides all read it here, so they agree on it.
 */
export function latestPracticeRange(
  voiceprints: readonly VoiceprintRecord[],
): VoiceprintRange | null {
  const range = latestVoiceprintRange(voiceprints)
  return range === null ? null : practiceRange(range)
}

/**
 * The newest voiceprint with a measured range decides
 * (latestPracticeRange). The result is always a natural note inside both
 * the voiceprint's range (when it holds one) and
 * HOLD_TARGET_MIN_MIDI..HOLD_TARGET_MAX_MIDI.
 */
export function pickHoldTarget(
  voiceprints: readonly VoiceprintRecord[],
  preset: HoldVoicePreset,
): HoldTarget {
  const latest = latestPracticeRange(voiceprints)

  if (latest === null) {
    return { midi: getComfortableMidiRange(preset).default, source: 'preset' }
  }

  const raw =
    latest.low + HOLD_TARGET_SPAN_FRACTION * (latest.high - latest.low)
  let midi = clampMidi(nearestNaturalMidi(raw))
  // Rounding can step one note past a very narrow range; step back to the
  // nearest natural inside it when there is one.
  if (midi < latest.low || midi > latest.high) {
    for (let m = Math.ceil(latest.low); m <= latest.high; m++) {
      if (isNatural(m)) {
        midi = clampMidi(m)
        break
      }
    }
  }
  return { midi, source: 'voiceprint' }
}

/** One semitone up or down, never outside the supported range. */
export function nudgeTarget(midi: number, step: 1 | -1): number {
  return clampMidi(Math.round(midi) + step)
}
