// ============================================================
// Team notes as the "never drawn" checks read them
// ============================================================
//
// Every signature and every variant note in team-notes.ts, each a whole
// sentence, so a page or card can only show one by drawing it. The unit
// tests and learn-no-planning-text.spec.ts hold a lesson page's output
// against this list.

import { HOOK_NOTES, SIGNATURES, TEASE_NOTES } from './team-notes'

/** Each of the team's strings, with what it is, for a failure to name. */
export const TEAM_STRINGS: readonly (readonly [what: string, text: string])[] =
  [
    ...Object.entries(SIGNATURES).map(
      ([n, text]) => [`lesson ${n}'s signature`, text ?? ''] as const,
    ),
    ...Object.entries(HOOK_NOTES).flatMap(([n, notes]) =>
      Object.entries(notes ?? {}).map(
        ([id, text]) => [`lesson ${n}'s hook ${id} note`, text ?? ''] as const,
      ),
    ),
    ...Object.entries(TEASE_NOTES).flatMap(([n, notes]) =>
      Object.entries(notes ?? {}).map(
        ([id, text]) => [`lesson ${n}'s tease ${id} note`, text ?? ''] as const,
      ),
    ),
  ]
