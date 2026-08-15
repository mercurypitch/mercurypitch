import { midiToNoteName } from '@/lib/frequency-to-note'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { PlaybackSession } from '@/types'

/**
 * Return the comfortable MIDI range for a given voice type preset.
 */
export function getComfortableMidiRange(preset: VocalRangePreset): {
  min: number
  max: number
  default: number
} {
  const range = VOCAL_RANGES[preset]
  return {
    min: (range.minOctave + 1) * 12, // C of minOctave
    max: (range.maxOctave + 1) * 12 + 11, // B of maxOctave
    default: (range.defaultOctave + 1) * 12, // C of defaultOctave
  }
}

/**
 * Returns a sensible default note name (e.g. 'A3') for the given voice type.
 * Tenor/baritone/bass default to A in their default octave; higher voices
 * default to C.
 */
export function getDefaultNote(preset: VocalRangePreset): string {
  const range = VOCAL_RANGES[preset]
  if (preset === 'soprano' || preset === 'mezzo-soprano' || preset === 'alto') {
    return midiToNoteName((range.defaultOctave + 1) * 12) // C of default octave
  }
  // tenor, baritone, bass — use A in the default octave
  return midiToNoteName(12 * (range.defaultOctave + 1) + 9) // A of default octave
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
 * The library melody a voice type should open on: the major scale rooted in
 * that voice's default octave, so a bass lands on `scale-major-c2` and a
 * soprano on `scale-major-c4`.
 */
export function vocalRangeMelodyId(preset: VocalRangePreset): string {
  return `scale-major-c${VOCAL_RANGES[preset].defaultOctave}`
}

/**
 * Every melody the auto-select is allowed to put in the roll — and therefore
 * the only ones it is allowed to take back out.
 */
const VOCAL_RANGE_MELODY_IDS: ReadonlySet<string> = new Set(
  (Object.keys(VOCAL_RANGES) as VocalRangePreset[]).map(vocalRangeMelodyId),
)

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
