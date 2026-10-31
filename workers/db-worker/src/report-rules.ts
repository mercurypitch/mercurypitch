// ── What a report may say ────────────────────────────────────────────
// What a report is about and why, as the worker takes it (reports.ts).
// Pure, so the phone's report sheet offers exactly the reasons the worker
// accepts, as the app imports validation.ts.

/** What can be reported: a singer (their name on a board), their profile,
 *  a shared melody, a shared result. */
export const REPORT_KINDS = ['user', 'profile', 'melody', 'session'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

/** Why. A fixed list, so a report can be sorted without reading its note. */
export const REPORT_REASONS = [
  'offensive',
  'abuse',
  'sexual',
  'spam',
  'impersonation',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/** The longest note a singer may add, in UTF-16 units. */
export const REPORT_NOTE_MAX = 500

/** The longest id a report or a block may name: a UUID with room to spare. */
export const TARGET_ID_MAX = 128

export interface ReportBody {
  targetKind: ReportKind
  targetId: string
  reason: ReportReason
  note: string | null
}

function oneOf<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (list as readonly string[]).includes(value)
  )
}

/** A singer's id as a request names it, or null when it cannot be one. */
export function readTargetId(value: unknown): string | null {
  return typeof value === 'string' &&
    value !== '' &&
    value.length <= TARGET_ID_MAX
    ? value
    : null
}

/** A report's body, or what is wrong with it. */
export function parseReportBody(
  value: unknown,
): ReportBody | { error: string } {
  if (typeof value !== 'object' || value === null) {
    return { error: 'A report is required' }
  }
  const body = value as Record<string, unknown>
  if (!oneOf(REPORT_KINDS, body.targetKind)) {
    return { error: `targetKind must be one of ${REPORT_KINDS.join(', ')}` }
  }
  const targetId = readTargetId(body.targetId)
  if (targetId === null) return { error: 'A targetId is required' }
  if (!oneOf(REPORT_REASONS, body.reason)) {
    return { error: `reason must be one of ${REPORT_REASONS.join(', ')}` }
  }
  if (
    body.note !== undefined &&
    body.note !== null &&
    typeof body.note !== 'string'
  ) {
    return { error: 'note must be text' }
  }
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > REPORT_NOTE_MAX) {
    return { error: `note must be at most ${REPORT_NOTE_MAX} characters` }
  }
  return {
    targetKind: body.targetKind,
    targetId,
    reason: body.reason,
    note: note === '' ? null : note,
  }
}
