// ============================================================
// The voiceprint Keep shows, and how it names its range
// ============================================================
//
// Keep's card is the take that creating an account here would adopt
// (REQ-NAM-037): the newest one made with nobody signed in, or under this
// phone's own identity, with a measured range. A take another account made
// on this phone is never shown or offered (REQ-NAM-040), and a take with no
// range makes no "Keep your voiceprint" (S7b §3.5: that title is for a
// measured range).

import { getDeviceId } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { loadLocalVoiceprints, MADE_ANONYMOUSLY, recordMadeBy, } from '@/db/services/voiceprint-service'
import { midiToNoteNameOctave, noteOnScreen } from '@/lib/note-utils'

/** A take Keep can show: one with both ends of its range measured. */
export interface KeepableVoiceprint {
  lowMidi: number
  highMidi: number
  twin: string | null
}

function adoptable(record: VoiceprintRecord, device: string): boolean {
  const madeBy = recordMadeBy(record)
  return madeBy === MADE_ANONYMOUSLY || (device !== '' && madeBy === device)
}

/** The newest take creating an account would adopt, with a range; else null. */
export function keepableVoiceprint(): KeepableVoiceprint | null {
  const device = getDeviceId()
  const newestFirst = [...loadLocalVoiceprints()].sort(
    (a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt),
  )
  for (const record of newestFirst) {
    const { lowMidi, highMidi } = record.summary
    if (!adoptable(record, device) || lowMidi === null || highMidi === null) {
      continue
    }
    return { lowMidi, highMidi, twin: record.twin }
  }
  return null
}

/** "E2–G4": the range as Progress writes it. */
export function keepRange(print: KeepableVoiceprint): string {
  const low = noteOnScreen(midiToNoteNameOctave(print.lowMidi))
  const high = noteOnScreen(midiToNoteNameOctave(print.highMidi))
  return `${low}–${high}`
}
