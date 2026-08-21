// Drum Night session boundary — import, score, kit, and evidence coaching.

export {
  drumSessionStateFromSong,
  IDLE_DRUM_SESSION,
  loadingDrumSession,
  readyDrumSessionDocument,
} from './drum-session'
export type {
  DrumSessionDocument,
  DrumSessionImportState,
  DrumSessionSourceFormat,
  DrumSessionUnsupportedReason,
} from './drum-session'

export {
  createDrumSessionImportController,
  importDrumSession,
  MAX_DRUM_SESSION_FILE_BYTES,
} from './import-drum-session'
export type {
  DrumSessionImportAttempt,
  DrumSessionImportController,
  DrumSessionImportOptions,
  DrumSessionImportPorts,
  DrumSessionParserOptions,
  DrumSessionParserOutcome,
} from './import-drum-session'
export {
  MAX_DRUM_SESSION_MUSICAL_EVENTS,
  MAX_DRUM_SESSION_SOURCE_EVENTS,
} from './drum-session-import-protocol'

export {
  createDrumSessionScheduler,
  DEFAULT_DRUM_SESSION_LOOKAHEAD_MS,
  MAX_DRUM_SESSION_DEDUPE_LEDGER,
  MAX_DRUM_SESSION_OCCURRENCES_PER_SCHEDULE,
  MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP,
} from './drum-session-scheduler'
export type {
  DrumScheduledSessionOccurrence,
  DrumSessionScheduler,
  DrumSessionSchedulerOptions,
  DrumSessionSchedulerSnapshot,
  DrumSessionSchedulerStatus,
  DrumSessionTriggerCounts,
  DrumSessionTriggerTruth,
} from './drum-session-scheduler'

export {
  createDrumScoreIndex,
  drumScoreBeatX,
  drumScoreEventsNearBeat,
  drumScoreNextEvent,
  drumScoreVoiceForGmKey,
  drumScoreWindow,
  drumScoreWindowBeatX,
  MAX_DRUM_SCORE_EVENTS,
  MAX_DRUM_SEMANTIC_EVENTS,
  projectDrumGroove,
  projectDrumScore,
} from './drum-score'
export type {
  DrumGrooveHit,
  DrumGrooveProjection,
  DrumGrooveStep,
  DrumNotehead,
  DrumScoreDocument,
  DrumScoreEvent,
  DrumScoreIndex,
  DrumScoreWindow,
  DrumScoreVoice,
  DrumSeatAnchor,
  DrumVoiceFamily,
} from './drum-score'

export { coachDrumSession } from './drum-coaching'
export type {
  DrumCapturedDirectHit,
  DrumCapturedHit,
  DrumCapturedMicOnset,
  DrumCoachingMatch,
  DrumCoachingOptions,
  DrumCoachingResult,
  DrumCoachingStatus,
  DrumDirectEvidenceSource,
  DrumRecoveryLoop,
} from './drum-coaching'

export {
  drumSessionStateCopy,
  DrumSessionStateView,
} from './DrumSessionStateView'
export type { DrumSessionStateCopy } from './DrumSessionStateView'
export { DrumScoreSheet } from './DrumScoreSheet'
export type { DrumScoreSheetProps } from './DrumScoreSheet'
export { DrummerSeatView } from './DrummerSeatView'
export type { DrummerSeatViewProps, DrumSeatLiveHit } from './DrummerSeatView'
export { DrumSessionCoach } from './DrumSessionCoach'
export type { DrumSessionCoachProps } from './DrumSessionCoach'
