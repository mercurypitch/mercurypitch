// ============================================================
// Room constants: the values the premium rooms share
// ============================================================
//
// Echo, Long note and the glide rooms (Lip roll, Ng slides) each kept
// their own copy of these. One copy now, so a room cannot drift from the
// others by accident. The fixtures keep their own silent Merc (steady 1,
// glide-fixture.ts and EchoFixture.tsx): a fixture frame is not a room's.

import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import type { MercVoice } from '@/lib/merc/sim'

/** Nobody sang for this long during a run: it stops, the mic closes. */
export const QUIET_LIMIT_SECONDS = 60

/** Merc with no voice to follow: quiet, still, at A3. */
export const SILENT_VOICE: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

/** The singer's own note, when a room can start from it. */
export function offerable(midi: number): boolean {
  return midi >= HOLD_TARGET_MIN_MIDI && midi <= HOLD_TARGET_MAX_MIDI
}
