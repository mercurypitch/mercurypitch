// ============================================================
// Drum pattern barrel — the authored groove catalog and its grid format
// ============================================================

export type {
  DrumPattern,
  DrumPatternCell,
  DrumPatternIssue,
  DrumPatternLaneReading,
  DrumPatternProvenance,
  DrumPatternStyle,
} from './drum-pattern'
export {
  createDrumPatternDocument,
  DRUM_PATTERN_GM_KEYS,
  DRUM_PATTERN_STEP_BEATS,
  DRUM_PATTERN_STEPS_PER_BAR,
  DRUM_PATTERN_SYMBOL_VELOCITIES,
  drumPatternDurationBeats,
  drumPatternHits,
  drumPatternIssues,
  drumPatternSong,
  parseDrumPatternLane,
} from './drum-pattern'
export {
  DRUM_PATTERN_STYLE_LABELS,
  DRUM_PATTERN_STYLE_ORDER,
  DRUM_PATTERNS,
  drumPatternsForStyle,
  findDrumPattern,
} from './drum-pattern-library'
export type { DrumPatternGridHit } from './drum-pattern'
export { drumPatternGridHits } from './drum-pattern'
// The picker component is deliberately absent: the app lazy-imports it from
// ./DrumPatternPicker so this data-only barrel never drags it into the shell.
