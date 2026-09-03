// Where your voice sits.
// ============================================================
//
// A chamber is built out of RATIOS -- mode n sounds at n times the room's
// fundamental -- and the ratios are the entire puzzle. Which absolute
// pitch the room is built on is free: transposing it does not make it
// easier, does not make it harder, and does not change a single node or
// belly (docs/games/standing-wave-chamber.md §2).
//
// So there is no "challenge" in singing high, and nothing is being
// softened by moving a room down. A room that sits outside a player's
// range is not a hard room, it is a room they cannot play.
//
// This module is the one place that answers "where does this player's
// voice sit", in MIDI, and everything that wants to know asks here:
//
//   1. an explicit choice -- a voice preset, or the octave buttons in
//      the room itself
//   2. failing that, the range the RangeFinder measured by listening
//   3. failing that, G4
//
// G4 was the whole bug. It is the Hallway's pane note, it was the
// fallback centre for every untuned chamber, and it sits between alto
// and soprano -- so the app quietly assumed a high voice and every lower
// one was asked to reach for notes it does not have.

/** The stored answer, when the player has given one. */
const CENTRE_KEY = 'beside-cue:games:voice-centre'
/** What the RangeFinder writes when it measures by listening. */
const MEASURED_KEY = 'beside-cue:games:vocal-range'

/**
 * The centre the app used to assume for everyone: G4, the Hallway's pane
 * note. Kept as the last resort, and only that.
 */
export const DEFAULT_CENTRE_MIDI = 67

/**
 * How far the centre may be moved.
 *
 * C2 to C6. Below C2 a sung note's fundamental starts falling under what
 * the detector reliably tracks in a room with any noise in it; above C6
 * there is nobody to sing it. Wide enough to hold every voice type twice
 * over, narrow enough that a stuck octave button cannot leave the room
 * inaudible.
 */
export const MIN_CENTRE_MIDI = 36
export const MAX_CENTRE_MIDI = 84

export interface VoicePreset {
  readonly id: string
  readonly label: string
  /** The comfortable span, in MIDI. Tessitura, not extremes: the notes
   * this voice can hold for a while without working at it. */
  readonly lowMidi: number
  readonly highMidi: number
}

/**
 * Voice types, by where they comfortably sit.
 *
 * Standard tessitura, rounded to whole octaves and fifths so the centres
 * land on named notes -- these are a starting point a player recognises
 * from choir or from karaoke, not a diagnosis. Anyone who finds their
 * pick a little high or low moves it by an octave in the room, or sings
 * into the range finder and gets their own numbers.
 */
export const VOICE_PRESETS: readonly VoicePreset[] = [
  { id: 'bass', label: 'Bass', lowMidi: 40, highMidi: 64 }, // E2-E4, centre E3
  { id: 'baritone', label: 'Baritone', lowMidi: 45, highMidi: 69 }, // A2-A4, centre A3
  { id: 'tenor', label: 'Tenor', lowMidi: 48, highMidi: 72 }, // C3-C5, centre C4
  { id: 'alto', label: 'Alto', lowMidi: 53, highMidi: 77 }, // F3-F5, centre F4
  { id: 'soprano', label: 'Soprano', lowMidi: 60, highMidi: 84 }, // C4-C6, centre C5
]

export const centreOf = (preset: {
  lowMidi: number
  highMidi: number
}): number => (preset.lowMidi + preset.highMidi) / 2

const clamp = (midi: number): number =>
  Math.min(MAX_CENTRE_MIDI, Math.max(MIN_CENTRE_MIDI, midi))

/** The explicit choice, if there is one. */
export const readVoiceCentre = (): number | null => {
  try {
    const raw = window.localStorage.getItem(CENTRE_KEY)
    if (raw === null) return null
    const midi = Number(raw)
    return Number.isFinite(midi) ? clamp(midi) : null
  } catch {
    return null
  }
}

export const writeVoiceCentre = (midi: number): number => {
  const value = clamp(midi)
  try {
    window.localStorage.setItem(CENTRE_KEY, String(value))
  } catch {
    // the choice just lives for the session when storage is denied
  }
  return value
}

/**
 * Forget the explicit choice, so a measurement takes over.
 *
 * Called when the range finder returns a fit: a voice that has actually
 * been listened to beats a voice type picked off a list, and leaving the
 * old pick in place would make the measurement do nothing.
 */
export const clearVoiceCentre = (): void => {
  try {
    window.localStorage.removeItem(CENTRE_KEY)
  } catch {
    // nothing was stored anyway
  }
}

/**
 * The range the RangeFinder measured, if it ever ran.
 *
 * Its record is a `RangeFit` and only two of its fields matter here; a
 * half-written or hand-edited one is treated as no measurement at all
 * rather than as a reason to throw inside a game.
 */
export const readMeasuredRange = (): {
  lowMidi: number
  highMidi: number
} | null => {
  try {
    const raw = window.localStorage.getItem(MEASURED_KEY)
    if (raw === null) return null
    const fit = JSON.parse(raw) as { loMidi?: number; hiMidi?: number }
    if (typeof fit.loMidi !== 'number' || typeof fit.hiMidi !== 'number') {
      return null
    }
    if (!(fit.hiMidi > fit.loMidi)) return null
    return { lowMidi: fit.loMidi, highMidi: fit.hiMidi }
  } catch {
    return null
  }
}

/** Where this player's voice sits: chosen, else measured, else G4. */
export const voiceCentre = (): number => {
  const chosen = readVoiceCentre()
  if (chosen !== null) return chosen
  const measured = readMeasuredRange()
  return measured === null ? DEFAULT_CENTRE_MIDI : clamp(centreOf(measured))
}

/** Move the centre by whole octaves, and keep it somewhere singable. */
export const shiftOctaves = (midi: number, octaves: number): number =>
  clamp(midi + octaves * 12)

/** Whether an octave step would actually move anything. */
export const canShift = (midi: number, octaves: number): boolean =>
  shiftOctaves(midi, octaves) !== clamp(midi)

/**
 * The preset a centre corresponds to, for showing which one is picked.
 * Null when it sits between them -- a measured voice usually will, and
 * pretending otherwise would light a button the player never pressed.
 */
export const presetAt = (midi: number): VoicePreset | null =>
  VOICE_PRESETS.find((p) => centreOf(p) === midi) ?? null
