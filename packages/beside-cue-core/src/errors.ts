// ============================================================
// Beside Cue domain errors — stable codes for application-layer handling
// ============================================================

export type CueDomainErrorCode =
  | 'active_cue_conflict'
  | 'cue_id_conflict'
  | 'cue_not_found'
  | 'invalid_cue_id'
  | 'invalid_cue_transition'
  | 'invalid_day_offset'
  | 'invalid_local_date'
  | 'invalid_local_time'
  | 'invalid_occurrence_id'
  | 'invalid_schedule_rule_id'
  | 'invalid_state_shape'
  | 'occurrence_cue_inactive'
  | 'occurrence_id_conflict'
  | 'occurrence_not_found'
  | 'occurrence_outcome_conflict'
  | 'occurrence_schedule_rule_disabled'
  | 'occurrence_schedule_rule_mismatch'
  | 'occurrence_state_conflict'
  | 'schedule_rule_cue_inactive'
  | 'schedule_rule_enabled_conflict'
  | 'schedule_rule_id_conflict'
  | 'schedule_rule_kind_conflict'
  | 'schedule_rule_not_found'

export class CueDomainError extends Error {
  constructor(
    readonly code: CueDomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CueDomainError'
  }
}
