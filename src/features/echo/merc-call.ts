// ============================================================
// Merc's call: a phrase's notes in, their playback scheduled out
// ============================================================
//
// Echo's call goes through this one seam, so the voice behind it can
// change without the room knowing. Today it is the synth "ooh"
// (playVoiceContour, demo-audio.ts) singing the phrase's line
// (phrase-voice.ts). The owner decided on 13 Oct 2026 that Merc sings the
// calls with vibrato, which comes as a sampler in a PR of its own and
// stands where SYNTH_CALL does.
//
// Both take the same thing in: the notes, each with its onset and length
// from the call's start, and the audio clock time the call starts at. Both
// hand back the same schedule: each note's onset and the call's end on
// that clock (the rings appear on the onsets, and the response opens
// after the end), and a stop.

import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { phraseToVoicePoints } from '@/lib/sequence/phrase-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'

/** A call on the audio clock, as it was scheduled. */
export interface CallSchedule {
  /** Each note's onset, audio clock seconds, in phrase order. */
  readonly onsets: readonly number[]
  /** The last note's end, audio clock seconds (a short release follows). */
  readonly endAt: number
  /** Stop it now. Safe to call more than once, and after it has ended. */
  stop(): void
}

/** A voice that sings Merc's calls. */
export interface CallVoice {
  /** Schedule `notes` to start at `startAt` on `ctx`'s clock. */
  sing(
    ctx: AudioContext,
    notes: readonly PhraseNote[],
    startAt: number,
  ): CallSchedule
}

/** The call's onsets and end on the audio clock, for a start time. */
export function callTimes(
  notes: readonly PhraseNote[],
  startAt: number,
): Pick<CallSchedule, 'onsets' | 'endAt'> {
  const end = notes.reduce(
    (latest, note) => Math.max(latest, note.at + note.seconds),
    0,
  )
  return {
    onsets: notes.map((note) => startAt + note.at),
    endAt: startAt + end,
  }
}

/** The synth "ooh", in the singer's octave, held and glided note to note. */
export const SYNTH_CALL: CallVoice = {
  sing(ctx, notes, startAt) {
    const times = callTimes(notes, startAt)
    if (notes.length === 0) return { ...times, stop: () => undefined }
    const refMidi = notes[0].midi
    const sound = playVoiceContour(
      ctx,
      phraseToVoicePoints({ notes }, refMidi),
      { hz: midiToFrequency(refMidi), startAt },
    )
    return { ...times, stop: () => sound.stop() }
  },
}
