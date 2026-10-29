// ============================================================
// Note tracker — when a voice is holding a note, and which one
// ============================================================
//
// A pitch frame every animation frame is not a note. Breath, consonants and
// the first wobble of an onset all produce confident-looking frames that are
// gone 30 ms later, and a visual that answered each of them would rain notes
// for every syllable of speech. A note lands only once its rounded pitch has
// held for LAND_MS. It stays landed through short gaps (a consonant, a quick
// breath) and ends after RELEASE_MS without a voiced frame. Cents are read
// against the landed note with some hysteresis, so a slide shows as a moving
// needle before it shows as a new note.
//
// A pure step on a state value, so the timing rules can be tested without a
// microphone.

import { frequencyToMidi } from '@/lib/frequency-to-note'
import { SIGNAL_FLOOR_RMS } from '@/lib/input-health'

/** How long a pitch must hold before it counts as a note. */
export const LAND_MS = 90
/** How long a landed note survives without a voiced frame. */
export const RELEASE_MS = 160
/** The detector clarity below which a frame is not trusted as voiced — the
 *  same bar pitch-f0-stream's smoothed view uses. */
export const MIN_CLARITY = 0.5
/** How far from the landed note the voice may wander, in cents, before a
 *  new note can land. Past the 50 cents where the rounding flips, so a voice
 *  sitting on the boundary does not flicker between two names. */
export const HOLD_TOLERANCE_CENTS = 65

export interface PitchReading {
  /** Detected fundamental in Hz, 0 when unvoiced. */
  f0: number
  /** Detector clarity, 0..1. */
  clarity: number
  /** Linear RMS of the analysed buffer. */
  rms: number
  /** Timestamp in ms. */
  at: number
}

export interface HeldNote {
  /** The note, as a whole MIDI number. */
  midi: number
  /** Where the voice sits against it, -50..50 or a little past. */
  cents: number
  f0: number
  /** When it landed, in ms. */
  since: number
}

export interface NoteTrackerState {
  candidate: { midi: number; since: number } | null
  held: HeldNote | null
  lastVoicedAt: number
}

export interface NoteStep {
  state: NoteTrackerState
  /** True on the one step where a note lands, including a change of note. */
  onset: boolean
}

export const initialNoteTracker = (): NoteTrackerState => ({
  candidate: null,
  held: null,
  lastVoicedAt: Number.NEGATIVE_INFINITY,
})

const isVoiced = (reading: PitchReading): boolean =>
  reading.f0 > 0 &&
  reading.clarity >= MIN_CLARITY &&
  reading.rms >= SIGNAL_FLOOR_RMS

export function trackNote(
  state: NoteTrackerState,
  reading: PitchReading,
): NoteStep {
  if (!isVoiced(reading)) {
    // A gap ends a note that has not landed yet. A landed one survives it
    // until the release runs out.
    const expired =
      state.held !== null && reading.at - state.lastVoicedAt > RELEASE_MS
    return {
      state: {
        candidate: null,
        held: expired ? null : state.held,
        lastVoicedAt: state.lastVoicedAt,
      },
      onset: false,
    }
  }

  const exact = frequencyToMidi(reading.f0, false)
  const held = state.held
  if (
    held !== null &&
    Math.abs(exact - held.midi) * 100 <= HOLD_TOLERANCE_CENTS
  ) {
    return {
      state: {
        candidate: null,
        held: {
          ...held,
          cents: (exact - held.midi) * 100,
          f0: reading.f0,
        },
        lastVoicedAt: reading.at,
      },
      onset: false,
    }
  }

  const midi = Math.round(exact)
  const candidate =
    state.candidate !== null && state.candidate.midi === midi
      ? state.candidate
      : { midi, since: reading.at }
  if (reading.at - candidate.since >= LAND_MS) {
    return {
      state: {
        candidate: null,
        held: {
          midi,
          cents: (exact - midi) * 100,
          f0: reading.f0,
          since: reading.at,
        },
        lastVoicedAt: reading.at,
      },
      onset: true,
    }
  }
  // Still deciding. Whatever was landed stays on screen meanwhile: a slide
  // into the next note should not blank the readout halfway.
  return {
    state: { candidate, held, lastVoicedAt: reading.at },
    onset: false,
  }
}
