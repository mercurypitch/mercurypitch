// Turning a loaded score into the lanes a sheet stacks. Placement itself lives
// in the reference port, so a note on the sheet sits exactly where the highway
// would put it; this file only decides which parts are drawn, in what order,
// and on whose neck.

import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, } from '@/lib/guitar/instrument-tuning'
import type { GuitarNightReferenceSource, GuitarNightReferenceSourceTrack, } from '../reference-port'
import { placeReferenceTrack, suggestReferenceInstrument, } from '../reference-port'
import type { SheetLane } from './sheet-model'

export interface SheetLaneSelection {
  /**
   * Tracks the reader chose to see. Omitted means every playable track. The
   * scored track is added even when it is not listed — a sheet that hides the
   * part being graded is never what was meant.
   */
  visibleTrackIds?: readonly string[]
  /** The track being scored. Drawn first, because it is read the most. */
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
  const shown =
    requested === undefined
      ? playable
      : playable.filter(
          (track) =>
            requested.includes(track.id) ||
            track.id === selection.scoredTrackId,
        )

  const scored = shown.find((track) => track.id === selection.scoredTrackId)
  if (scored === undefined) return shown
  return [scored, ...shown.filter((track) => track !== scored)]
}
