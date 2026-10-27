// ============================================================
// Merc's call: a phrase's notes in, their playback scheduled out
// ============================================================
//
// Echo's call goes through this one seam, so the voice behind it can
// change without the room knowing. The owner decided on 13 Oct 2026 that
// Merc sings the calls with vibrato: the room's voice is MERC_CALL
// (merc-sampler.ts), his recorded "ooh". The synth "ooh" here
// (playVoiceContour, demo-audio.ts, singing the phrase's line from
// phrase-voice.ts) sings while his voice loads, if it cannot load, and any
// call his voice set does not reach.
//
// Both take the same thing in: the notes, each with its onset and length
// from the call's start, and the audio clock time the call starts at. Both
// hand back the same schedule: each note's onset and the call's end on
// that clock (the rings appear on the onsets, and the response opens
// after the end), and a stop.
//
// The room hears the call on the frames' clock, not the audio clock:
// scheduleCall sings it a little ahead and carries every time in it to the
// frames' clock, with the output latency, so each note is dated as the
// speaker plays it.

import { roomOutput } from '@/components/room-kit/room-output'
import { outputLatency } from '@/components/room-kit/round-voice'
import { playVoiceContour } from '@/lib/demo-audio'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { phraseToVoicePoints } from '@/lib/sequence/phrase-voice'
import type { PhraseNote } from '@/lib/sequence/sequence-engine'
import type { CallNote } from './early-singing'

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
      {
        hz: midiToFrequency(refMidi),
        startAt,
        destination: roomOutput(ctx),
        lowNoteOctave: true,
      },
    )
    return { ...times, stop: () => sound.stop() }
  },
}

/** The call under way: its sound and its notes on the frames' clock. */
export interface Call {
  readonly sound: CallSchedule
  readonly notes: readonly CallNote[]
  /** When the call has ended at the speaker, frames' clock. */
  readonly endsAt: number
}

/**
 * `voice` sings `notes` `lead` seconds from now on `ctx`'s clock. The
 * frames' clock starts now (the capture window has just opened), and the
 * speaker is the output latency behind the audio clock.
 */
export function scheduleCall(
  voice: CallVoice,
  ctx: AudioContext,
  notes: readonly PhraseNote[],
  lead: number,
): Call {
  const a0 = ctx.currentTime
  const latency = outputLatency(ctx)
  const sound = voice.sing(ctx, notes, a0 + lead)
  const onFrames = (t: number): number => t - a0 + latency
  return {
    sound,
    notes: notes.map((note, i) => ({
      from: onFrames(sound.onsets[i]),
      to: onFrames(sound.onsets[i] + note.seconds),
      midi: note.midi,
    })),
    endsAt: onFrames(sound.endAt),
  }
}
