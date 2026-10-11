// ============================================================
// Whether the Long note demo plays by itself on the way in
// ============================================================
//
// A first visit: the demo unseen and no note held yet. One rule for the
// room (useLongNoteDemo opens on it) and for the Sing screen's picker, which
// says so before the singer goes in.
//
// Its own module rather than a line in demo-seen.ts: it reads both stores
// through their exports, so a suite that stands in for either store (the
// demo's own does, for both) drives this rule with it.

import { rememberedLongNote } from '../remembered-note'
import { longNoteDemoSeen } from './demo-seen'

export function longNoteDemoAutoPlays(): boolean {
  return !longNoteDemoSeen() && rememberedLongNote() === null
}
