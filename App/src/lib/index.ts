// ============================================================
// Library barrel export
// ============================================================

export { AudioEngine } from './audio-engine';
export { PitchDetector } from './pitch-detector';
export { PianoRollEditor } from './piano-roll';
export {
  NOTE_NAMES,
  WHITE_NOTE_NAMES,
  MAJOR_SCALE_INTERVALS,
  KEY_SIGNATURES,
  SCALE_DEFINITIONS,
  midiToFreq,
  freqToMidi,
  noteToMidi,
  midiToNote,
  freqToNote,
  buildMajorScale,
  buildMultiOctaveScale,
  buildSampleMelody,
  melodyTotalBeats,
  melodyNoteAtBeat,
  melodyIndexAtBeat,
  isBlackKey,
  melodyMidiRange,
} from './scale-data';
