// ============================================================
// Beside Cue v1 domain — persistence-safe records without platform types
// ============================================================

export type CueId = string
export type CueOccurrenceId = string
export type ScheduleRuleId = string
export type Instant = string
export type LocalDate = string
export type LocalTime = string

export type CueStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface Cue {
  readonly id: CueId
  readonly status: CueStatus
  readonly pullCategoryId?: string
  readonly pullText: string
  readonly bSideSuggestionId?: string
  readonly bSideText: string
  readonly mascotSetId: string
  readonly createdAt: Instant
  readonly updatedAt: Instant
  readonly archivedAt?: Instant
}

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ScheduleRuleKind = 'target_time' | 'window'

interface ScheduleRuleBase {
  readonly id: ScheduleRuleId
  readonly cueId: CueId
  readonly daysOfWeek: readonly DayOfWeek[]
  readonly enabled: boolean
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

export interface TargetTimeScheduleRule extends ScheduleRuleBase {
  readonly kind: 'target_time'
  readonly localTime: LocalTime
}

export interface WindowScheduleRule extends ScheduleRuleBase {
  readonly kind: 'window'
  readonly windowStart: LocalTime
  readonly windowEnd: LocalTime
}

/**
 * v1 stores schedule intent only. Turning a rule into concrete notification
 * instants belongs to a platform scheduler and can evolve without migration.
 */
export type ScheduleRule = TargetTimeScheduleRule | WindowScheduleRule

export type CueOccurrenceSource = 'scheduled' | 'manual'
export type CueOccurrenceOutcome = 'b_side' | 'not_now'

interface CueOccurrenceBase {
  readonly id: CueOccurrenceId
  readonly cueId: CueId
}

interface ManualCueOccurrenceBase extends CueOccurrenceBase {
  readonly source: 'manual'
  readonly scheduleRuleId?: never
  readonly plannedFor?: never
}

interface ScheduledCueOccurrenceBase extends CueOccurrenceBase {
  readonly source: 'scheduled'
  readonly scheduleRuleId: ScheduleRuleId
  readonly plannedFor: Instant
}

interface UnresolvedCueOccurrenceFields {
  readonly outcome?: never
  readonly outcomeAt?: never
  readonly outcomeLocalDate?: never
}

export interface PlannedCueOccurrence
  extends ScheduledCueOccurrenceBase, UnresolvedCueOccurrenceFields {
  readonly state: 'planned'
  readonly openedAt?: never
}

export interface PresentedManualCueOccurrence
  extends ManualCueOccurrenceBase, UnresolvedCueOccurrenceFields {
  readonly state: 'presented'
  readonly openedAt: Instant
}

export interface PresentedScheduledCueOccurrence
  extends ScheduledCueOccurrenceBase, UnresolvedCueOccurrenceFields {
  readonly state: 'presented'
  readonly openedAt: Instant
}

export type PresentedCueOccurrence =
  | PresentedManualCueOccurrence
  | PresentedScheduledCueOccurrence

export type PendingCueOccurrence = PlannedCueOccurrence | PresentedCueOccurrence

export interface CancelledManualCueOccurrence
  extends ManualCueOccurrenceBase, UnresolvedCueOccurrenceFields {
  readonly state: 'cancelled'
  readonly openedAt: Instant
}

export interface CancelledScheduledCueOccurrence
  extends ScheduledCueOccurrenceBase, UnresolvedCueOccurrenceFields {
  readonly state: 'cancelled'
  readonly openedAt?: Instant
}

export type CancelledCueOccurrence =
  | CancelledManualCueOccurrence
  | CancelledScheduledCueOccurrence

interface ResolvedCueOccurrenceFields {
  readonly state: 'resolved'
  readonly openedAt: Instant
  readonly outcome: CueOccurrenceOutcome
  readonly outcomeAt: Instant
  /** Local calendar date captured when the outcome is recorded. */
  readonly outcomeLocalDate: LocalDate
}

export interface ResolvedManualCueOccurrence
  extends ManualCueOccurrenceBase, ResolvedCueOccurrenceFields {}

export interface ResolvedScheduledCueOccurrence
  extends ScheduledCueOccurrenceBase, ResolvedCueOccurrenceFields {}

export type ResolvedCueOccurrence =
  | ResolvedManualCueOccurrence
  | ResolvedScheduledCueOccurrence

export type CueOccurrence =
  | PendingCueOccurrence
  | CancelledCueOccurrence
  | ResolvedCueOccurrence

export interface QuietHoursSettings {
  readonly enabled: boolean
  readonly start: LocalTime
  readonly end: LocalTime
}

export type LockScreenDetail = 'discreet' | 'detailed'
export type MotionSetting = 'system' | 'reduced' | 'full'

export interface AppSettings {
  readonly quietHours: QuietHoursSettings
  readonly lockScreenDetail: LockScreenDetail
  readonly scheduledSoundEnabled: boolean
  readonly acknowledgementSoundEnabled: boolean
  readonly hapticsEnabled: boolean
  readonly voiceEnabled: boolean
  readonly motion: MotionSetting
  readonly locale: string
}

export interface SchemaMetadataV1 {
  readonly schemaVersion: 1
  readonly completedMigrationVersion: number
}

/** Complete local snapshot. Cues remain a collection even under v0's limit. */
export interface BesideCueStateV1 {
  readonly schema: SchemaMetadataV1
  readonly cues: readonly Cue[]
  readonly scheduleRules: readonly ScheduleRule[]
  readonly occurrences: readonly CueOccurrence[]
  readonly settings: AppSettings
}
