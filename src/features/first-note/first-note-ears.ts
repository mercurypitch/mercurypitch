// ============================================================
// First note's ears: the singer's entry and the note the engine hears
// ============================================================
//
// What a round listens for, shared by the room (useFirstNoteController.ts)
// and its demo's script (demo/demo-script.ts), so the demo is heard by
// exactly the rules a run is. The entry is the first note the voice sits
// on, held ENTRY_MS within ENTRY_STEADY_CENTS of its own centre on one run
// of voice, folded to the note's nearest octave: on the note when that
// centre is inside the level's band. The engine hears the round as one
// note, the song's first, as the band plays it.
//
// Pure: the voice's readings in, the entry (or nothing yet) out.

import type { PitchPoint } from '@/lib/hold/hold-reading'
import { holdPresetFor } from '@/lib/sequence/note-listener'
import type { Phrase } from '@/lib/sequence/sequence-engine'
import { firstSteadyNote } from '@/lib/sequence/steady-note'
import type { EntryHeard } from './first-note-machine'
import type { FirstNoteLevel } from './first-note-rules'
import { ENTRY_MS, ENTRY_RUN_GAP_SEC, ENTRY_STEADY_CENTS, MERC_NOTE_SECONDS, } from './first-note-rules'
import type { FirstNoteRound } from './first-note-songs'
import { entryPitch } from './first-note-songs'

/** The singer's entry in the voice heard so far; null before there is one. */
export function entryHeardIn(
  heard: readonly PitchPoint[],
  round: FirstNoteRound,
  rules: FirstNoteLevel,
): EntryHeard | null {
  const steady = firstSteadyNote(heard, {
    targetMidi: entryPitch(round.entry),
    tolCents: ENTRY_STEADY_CENTS,
    landMs: ENTRY_MS,
    octaveFold: true,
    heldOver: false,
    centreTauSec: holdPresetFor(rules).centreTauSec,
    runGapSec: ENTRY_RUN_GAP_SEC,
  })
  if (steady === null) return null
  return {
    cents: steady.cents,
    onNote: Math.abs(steady.cents) <= rules.tolCents,
  }
}

/** The round as the engine hears it: the song's first note, as the band plays it. */
export function entryPhrase(round: FirstNoteRound): Phrase {
  return {
    notes: [
      { midi: entryPitch(round.entry), at: 0, seconds: MERC_NOTE_SECONDS },
    ],
  }
}
