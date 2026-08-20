// Turning a loaded score into the lanes a sheet stacks. Placement itself lives
// in the reference port, so a note on the sheet sits exactly where the highway
// would put it; this file only decides which parts are drawn, in what order,
// and on whose neck.

import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import type { GuitarNightReference, GuitarNightReferenceSource, GuitarNightReferenceSourceTrack, } from '../reference-port'
import { placeReferenceTrack, suggestReferenceInstrument, } from '../reference-port'
import type { SheetLane } from './sheet-model'

export interface SheetLaneSelection {
  /**
   * Tracks the reader chose to see. Omitted means every playable track. The
   * scored track is added even when it is not listed — a sheet that hides the
   * part being graded is never what was meant.
   */
  visibleTrackIds?: readonly string[]
  /** The track being scored. Marked wherever it sits, never moved. */
  scoredTrackId?: string
  /** The neck the player picked for the scored part, when they overrode it. */
  scoredTuning?: InstrumentTuning
}

/** Every track of a score that has notes to draw, in source order. */
export function playableSheetTracks(
  source: GuitarNightReferenceSource,
): readonly GuitarNightReferenceSourceTrack[] {
  return source.tracks.filter((track) => track.notes.length > 0)
}

/**
 * Build the lanes for one score. Every lane is placed on its own authored neck,
 * so a bass part keeps four strings while the guitar above it keeps six.
 */
export function sheetLanesFromSource(
  source: GuitarNightReferenceSource,
  selection: SheetLaneSelection = {},
): SheetLane[] {
  const playable = playableSheetTracks(source)
  const visible = selectVisibleTracks(playable, selection)

  return visible.map((track) => {
    const scored = track.id === selection.scoredTrackId
    const suggestion = suggestReferenceInstrument(source, track.id)
    const fallbackTuning =
      suggestion?.instrument === 'bass'
        ? DEFAULT_BASS_TUNING
        : DEFAULT_GUITAR_TUNING
    const placed = placeReferenceTrack(track, {
      ...(scored && selection.scoredTuning !== undefined
        ? { tuning: selection.scoredTuning }
        : {}),
      fallbackTuning,
    })

    return {
      trackId: placed.trackId,
      trackName: placed.trackName,
      kind: 'authored',
      instrument: placed.instrument,
      tuning: placed.tuning,
      notes: placed.notes,
      outOfRangeNotes: placed.outOfRangeNotes,
    }
  })
}

function selectVisibleTracks(
  playable: readonly GuitarNightReferenceSourceTrack[],
  selection: SheetLaneSelection,
): readonly GuitarNightReferenceSourceTrack[] {
  const requested = selection.visibleTrackIds
  // Written order, always. Promoting the scored part to the top means every
  // other part jumps a row the moment a reader taps a name, which reads as the
  // sheet doing something unexplained. A score's parts have a fixed vertical
  // order; scoring marks one of them, it does not rearrange the page.
  return requested === undefined
    ? playable
    : playable.filter(
        (track) =>
          requested.includes(track.id) || track.id === selection.scoredTrackId,
      )
}

/**
 * The one lane a reference can supply on its own. A stem line transcribed from
 * a recording has no library score behind it, and runs on the recording's clock
 * rather than a written one — so it reads as a sheet of exactly one part, never
 * stacked under a tab that counts its bars differently.
 */
export function sheetLaneFromReference(
  reference: GuitarNightReference,
): SheetLane {
  return {
    trackId: reference.trackId,
    trackName: reference.trackName,
    kind: reference.kind,
    instrument: reference.tuning.instrument,
    tuning: reference.tuning,
    notes: reference.notes,
    outOfRangeNotes: reference.outOfRangeNotes,
  }
}
