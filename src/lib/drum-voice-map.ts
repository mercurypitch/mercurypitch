// Drum voice map — dependency-free GM folds for the shared synth recipes.
// ============================================================

import type { DrumVoiceId } from './drum-voices'

/**
 * Deliberate folds from the General MIDI acoustic-kit map to the twelve synth
 * recipes that can represent them honestly. Unsupported auxiliary percussion
 * stays silent until a matching voice/sample exists; it never becomes snare.
 */
const DRUM_VOICE_BY_MIDI: ReadonlyMap<number, DrumVoiceId> = new Map([
  [35, 'kick'],
  [36, 'kick'],
  [37, 'sidestick'],
  [38, 'snare'],
  [39, 'clap'],
  [40, 'snare'],
  [41, 'tom-low'],
  [42, 'hh-closed'],
  [43, 'tom-low'],
  [44, 'hh-pedal'],
  [45, 'tom-low'],
  [46, 'hh-open'],
  [47, 'tom-mid'],
  [48, 'tom-high'],
  [49, 'crash'],
  [50, 'tom-high'],
  [51, 'ride'],
  [52, 'crash'],
  [53, 'ride'],
  [55, 'crash'],
  [57, 'crash'],
  [59, 'ride'],
])

export function drumVoiceForMidi(midi: number): DrumVoiceId | null {
  return DRUM_VOICE_BY_MIDI.get(midi) ?? null
}
