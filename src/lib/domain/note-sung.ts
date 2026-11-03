// ============================================================
// Note sung — whether a graded note holds anything the singer sang
// ============================================================
//
// The practice engine grades every note a run reaches, sung or not
// (`finalizeNoteResult`). A note it heard no pitch for has no cents to
// average, so it is written as rating 'off' with 0 cents. Read as a
// deviation, those 0 cents are a dead-centre hit: a session never sung
// would land every note, and the heatmap would paint each one perfect.
//
// A note sung at 0 cents rates 'perfect', and 'off' means more than the
// worst band's cents, so 'off' with exactly 0 cents is only ever a note
// nobody sang. Persisted history was written by the same rule, so this
// reads old records too.

import type { NoteResult } from '@/types'

/** Whether the singer sang this note at all, however far off. */
export function noteWasSung(
  note: Pick<NoteResult, 'rating' | 'avgCents'>,
): boolean {
  return note.rating !== 'off' || note.avgCents !== 0
}
