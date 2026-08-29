// ============================================================
// Drum Night groove editor — pure domain and session-local draft boundary
// ============================================================

export {
  activeDrumGrooveHits,
  applyDrumGrooveCommand,
  createEditableDrumGroove,
  DRUM_GROOVE_FAMILIES,
  DRUM_GROOVE_STEPS_PER_BAR,
  DRUM_GROOVE_SUBDIVISION_BEATS,
  groupDrumGrooveHits,
  materializeDrumGrooveDocument,
  MAX_DRUM_GROOVE_HITS,
  MAX_DRUM_GROOVE_SWING_OFFSET_BEATS,
  MAX_DRUM_GROOVE_UNDO_STEPS,
} from './groove-editor'
export type {
  DrumGrooveEditCommand,
  DrumGrooveEditFailureReason,
  DrumGrooveEditOutcome,
  DrumGrooveFamilyGroup,
  DrumGrooveFamilyMetadata,
  DrumGrooveHitOrigin,
  DrumGrooveUndoSnapshot,
  EditableDrumGrooveBarCount,
  EditableDrumGrooveHit,
  EditableDrumGrooveState,
  EditorDrumGrooveHitOrigin,
  SourceDrumGrooveHitOrigin,
} from './groove-editor'
export {
  createDrumGrooveDraftController,
  DRUM_GROOVE_PAGE_SIZES,
} from './drum-groove-draft-controller'
export type {
  DrumGrooveDraftChange,
  DrumGrooveDraftController,
  DrumGrooveDraftControllerOptions,
  DrumGrooveMovePreview,
  DrumGroovePageSize,
} from './drum-groove-draft-controller'
export {
  browserDrumFeelStorage,
  DEFAULT_DRUM_FEEL_SETTINGS,
  DRUM_FEEL_STORAGE_KEY,
  isHumanizeStyle,
  readDrumFeelSettings,
  writeDrumFeelSettings,
} from './drum-feel-preference'
export type { DrumFeelSettings } from './drum-feel-preference'
export {
  HUMANIZE_STYLE_PROFILES,
  humanizeDrumEvents,
  measuredProfileCell,
  suggestGhostSteps,
  swingRatioForTempo,
  swingShiftMs,
} from './groove-humanize'
export type {
  GhostSuggestion,
  HumanizedEvent,
  HumanizeInputEvent,
  HumanizeOptions,
  HumanizeOrnament,
  HumanizeStyle,
} from './groove-humanize'
