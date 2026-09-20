import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { PlaybackSession } from '@/types'

/**
 * Return the comfortable MIDI range for a given voice type preset.
 *
 * The notes themselves (`VOCAL_RANGES`), not the octaves that contain them:
 * "C of the lowest octave to B of the highest" gave a baritone C2 to B4,
 * which is a fourth lower and a third higher than a baritone sings, and
 * everything that fits a phrase into this range then fitted it too low.
 */
export function getComfortableMidiRange(preset: VocalRangePreset): {
  min: number
  max: number
  default: number
} {
  const range = VOCAL_RANGES[preset]
  return {
    min: range.lowMidi,
    max: range.highMidi,
    default: range.anchorMidi,
  }
}

/**
 * How many semitones -- always whole octaves -- bring a span of notes into
 * the singer's range.
 *
 * Octaves only, so the contour and every pitch class survive. When more than
 * one octave fits, the one whose centre sits closest to the middle of the
 * range wins; a span too wide to fit at all is centred and allowed to spill
 * equally at both ends.
 */
export function octaveShiftIntoRange(
  lowMidi: number,
  highMidi: number,
  preset: VocalRangePreset,
): number {
  const { min, max } = getComfortableMidiRange(preset)
  const spanCentre = (lowMidi + highMidi) / 2
  const rangeCentre = (min + max) / 2

  // Octave shifts that keep the whole span inside [min, max]. The loop
  // starts at the smallest multiple of 12 that lifts the bottom to (or past)
  // the floor, so every shift it yields respects the bottom by construction.
  const fits: number[] = []
  for (
    let shift = Math.ceil((min - lowMidi) / 12) * 12;
    highMidi + shift <= max;
    shift += 12
  ) {
    fits.push(shift)
  }

  const best =
    fits.length > 0
      ? fits.reduce((a, b) =>
          Math.abs(spanCentre + b - rangeCentre) <
          Math.abs(spanCentre + a - rangeCentre)
            ? b
            : a,
        )
      : // Too wide to fit: centre it. Rounded to whole octaves so the
        // pitch classes still match what the session card named.
        Math.round((rangeCentre - spanCentre) / 12) * 12
  // `Math.ceil(-0 / 12) * 12` is -0, and a shift of minus nothing reads as a
  // change to anything comparing with Object.is.
  return best === 0 ? 0 : best
}

/**
 * Transpose a phrase, whole, into the singer's comfortable range.
 *
 * `apply-melodies.ts` has promised since it was written that "the exercise
 * engine … can transpose into the singer's range"; this is that transpose,
 * finally. Octave shifts only — the contour and every pitch class survive,
 * so London Bridge is still London Bridge, just where a baritone can sing
 * it. When more than one octave fits, the one whose centre sits closest to
 * the middle of the range wins; a phrase too wide to fit at all (none of
 * ours are) is centred and allowed to spill equally rather than clamped
 * note by note, which would flatten the melody. A phrase with any
 * unparseable note is returned untouched — better the authored notes than
 * a half-transposed hybrid.
 */
export function fitPhraseToRange(
  notes: string[],
  preset: VocalRangePreset,
): string[] {
  if (notes.length === 0) return notes
  const midis = notes.map(noteToMidi)
  if (midis.some(Number.isNaN)) return notes

  const best = octaveShiftIntoRange(
    Math.min(...midis),
    Math.max(...midis),
    preset,
  )
  return best === 0 ? notes : midis.map((midi) => midiToNoteName(midi + best))
}

/**
 * Fit a one-octave-run base note so the run's TOP fits the singer too.
 *
 * Scale Runner always closes on the octave, so its highest note is the base
 * plus twelve — which means a base that is comfortably in range can still
 * send the top note past the ceiling (the launched G4 that marched a
 * baritone to G5). Folds the base down an octave when the top would not
 * fit. Every preset spans at least two octaves (an invariant the tests
 * pin), so a base high enough to need the fold is always high enough to
 * survive it. Unparseable input is returned untouched.
 */
export function fitScaleBaseNote(
  note: string,
  preset: VocalRangePreset,
): string {
  const midi = noteToMidi(note)
  if (Number.isNaN(midi)) return note
  const { max } = getComfortableMidiRange(preset)
  return midi + 12 > max ? midiToNoteName(midi - 12) : note
}

/**
 * Where an exercise starts for this voice type (e.g. 'C3' for a baritone).
 *
 * The preset's anchor: a one-octave run up from it stays inside the range
 * with room at both ends. It used to be "A of the default octave" for the low
 * voices and "C of it" for the high ones, which put a baritone on A2 and an
 * alto on C3 -- the second of those below the bottom of her range.
 */
export function getDefaultNote(preset: VocalRangePreset): string {
  return midiToNoteName(VOCAL_RANGES[preset].anchorMidi)
}

/**
 * Generate chromatic note name options (e.g. ['C3','D3',...'B5']) across the
 * voice type's full comfortable range.
 */
export function getNoteOptions(preset: VocalRangePreset): string[] {
  const { min, max } = getComfortableMidiRange(preset)
  const notes: string[] = []
  for (let midi = min; midi <= max; midi++) {
    notes.push(midiToNoteName(midi))
  }
  return notes
}

/**
 * The library melody a voice type should open on: the C major scale in the
 * octave that sits inside that voice's range, so a baritone lands on
 * `scale-major-c3` (C3 to C4) and a soprano on `scale-major-c4`.
 *
 * No voice lands on `scale-major-c2` any more. C2 to C3 starts a major third
 * under the bottom of a BASS; it was the default for baritones too.
 */
export function vocalRangeMelodyId(preset: VocalRangePreset): string {
  return `scale-major-c${VOCAL_RANGES[preset].defaultOctave}`
}

/**
 * Every melody the auto-select is allowed to put in the roll — and therefore
 * the only ones it is allowed to take back out.
 */
const VOCAL_RANGE_MELODY_IDS: ReadonlySet<string> = new Set([
  ...(Object.keys(VOCAL_RANGES) as VocalRangePreset[]).map(vocalRangeMelodyId),
  // No voice is sent here any more, but every baritone and bass WAS, and it
  // is still sitting in their piano roll. If the auto-select stopped calling
  // it its own, it would read as the singer's work and never be taken back
  // out -- the one group the corrected table exists for would not get it.
  'scale-major-c2',
])

/** Is this melody one the auto-select put there itself? */
export function isVocalRangeMelody(melodyId: string): boolean {
  return VOCAL_RANGE_MELODY_IDS.has(melodyId)
}

/**
 * Which melody the Default Session should open for this voice type, or `null`
 * when it should open nothing.
 *
 * Two id namespaces meet here and they do not interchange. A `SessionItem`
 * carries its own `id` — a generated key, unique per item, meaningless to the
 * melody library — and separately a `melodyId` pointing at the library entry
 * it plays. The caller of this auto-select fed the ITEM id to the loader,
 * which looks its argument up with `melodyStore.getMelody`. That lookup could
 * never hit: the default session's items are built with
 * `generateSessionItemId()`, so no item id is ever a melody id.
 *
 * The consequence was invisible for as long as a miss returned in silence —
 * the auto-select simply never worked, and nobody knew there was a feature to
 * miss. Once the loader started warning on a miss (a session item may outlive
 * its melody, and a pill that did nothing at all was worse), the same dead
 * lookup started announcing "That melody was deleted." on every single page
 * load, about a melody sitting right there in the library.
 *
 * So this returns a MELODY id, and returns `null` rather than a melody the
 * library cannot resolve. The second part matters as much as the first: this
 * runs off an effect on every load, and a real miss here is not the singer
 * pressing a dead pill — it must not borrow that warning.
 *
 * `loadedMelodyId` is the third refusal, and the one that only became
 * necessary once the rest of this worked. Loading a melody REPLACES what is in
 * the piano roll. For as long as the lookup missed, that was theoretical;
 * the moment it hit, an effect keyed on the session started overwriting
 * whatever the singer had open — an import, an edit, a recording — every time
 * the session settled. A convenience is not allowed to destroy work. So it
 * declines unless the roll holds one of its own scales, or nothing at all.
 */
export function pickVocalRangeMelody(
  session: PlaybackSession | null | undefined,
  preset: VocalRangePreset,
  melodyExists: (melodyId: string) => boolean,
  loadedMelodyId: string | null,
): string | null {
  if (session === null || session === undefined || session.id !== 'default') {
    return null
  }

  const melodyId = vocalRangeMelodyId(preset)
  // Already open. Reloading it would restart nothing and lose any edit in
  // progress on the scale itself.
  if (loadedMelodyId === melodyId) return null
  if (loadedMelodyId !== null && !isVocalRangeMelody(loadedMelodyId)) {
    return null
  }

  const inSession = session.items.some(
    (item) => item.type === 'melody' && item.melodyId === melodyId,
  )

  return inSession && melodyExists(melodyId) ? melodyId : null
}
