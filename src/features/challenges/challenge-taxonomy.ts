// ============================================================
// Challenge taxonomy: the feat and difficulty tags a Legend can carry
// ============================================================
// Shared by the authoring page's pickers and by the check on
// scripts/legend-queue.mjs, so a queued row can only carry a tag the admin
// form can show and save back. Home and Past Legends print the tag as it is
// stored (dashes read as spaces in the archive), so each one is also copy.

/** What the line asks of a voice. */
export const FEAT_TYPES = [
  'money-note',
  'sustain',
  'low-note',
  'range',
  'melisma-run',
  'register-jump',
  'vibrato',
  'belt-vs-falsetto',
  // Half steps in a row, each placed rather than slid through.
  'chromatic',
] as const

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
