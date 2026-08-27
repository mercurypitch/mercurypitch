/** @irchiinnuss/pitch-engine — mic lifecycle + SwiftF0 pitch stream.
 *
 * Modules are verbatim extractions from the root app's src/lib (see each
 * file header); this package is the source of truth for products that need
 * voice input outside the root app, starting with Beside Cue's mini-games.
 */

export {
  CDN_FALLBACK,
  configurePitchEngineAssets,
  pitchEngineModelPath,
} from './assets'
export type { PitchEngineAssetConfig } from './assets'
export { playApproachAndLock, playHoldTone, playTargetHum } from './demo-audio'
export { freqToMidi, freqToNote, midiToFreq, midiToNote } from './freq-note'
export type { NoteInfo, NoteName } from './freq-note'
export {
  CONF_MIN,
  centsToMidi,
  hzToCents,
  medianFilter,
  preprocessF0Frames,
} from './measurements'
export type { F0Frame, VoicedFrame } from './measurements'
export { micLevelFraction, readMicLevel } from './mic-level'
export { micManager } from './mic-manager'
export { createF0Stream } from './pitch-f0-stream'
export type { F0Stream, PitchFrame } from './pitch-f0-stream'
export {
  midiToNoteName,
  midiToNoteNameOctave,
  NOTE_NAMES,
  noteColor,
} from './note-utils'
