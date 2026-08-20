// The rest of the band: the parts of a loaded score that are not the one being
// scored. Reported 2026-08-20 — "when I load a GP5 tab and select the track to
// score against there is no way to control the other tracks mute/hear, and by
// default all others are muted. But usually it should be other way around, we
// should play all but the scored against so user can play."
//
// So that is the default here: every other part sounds, and the part you are
// graded on is yours to play. Nothing in this file touches audio or the DOM —
// it turns a score into notes for the band and answers which parts are on.

import type { GuitarRoomBandNote } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'
import type { GuitarNightReferenceSource } from './reference-port'
import { suggestReferenceInstrument } from './reference-port'

export interface BackingPartSelection {
  /** The part the player is being graded on. Never sounded as backing. */
  scoredTrackId?: string
  /**
   * Parts the player chose to hear. Omitted means every part except the scored
   * one, which is the default a multi-part tab wants.
   */
  audibleTrackIds?: readonly string[]
}

/** One part of the score the room can sound underneath the player. */
export interface BackingPart {
  trackId: string
  name: string
  variant: GuitarVariant
  noteCount: number
}

/** Every part that could play under the scored one, in written order. */
export function backingParts(
  source: GuitarNightReferenceSource,
  scoredTrackId?: string,
): readonly BackingPart[] {
  return source.tracks
    .filter((track) => track.notes.length > 0 && track.id !== scoredTrackId)
    .map((track) => ({
      trackId: track.id,
      name: track.name,
      variant: variantForTrack(source, track.id),
      noteCount: track.notes.length,
    }))
}

/**
 * Notes for the band, merged across every audible part and each carrying its
 * own timbre — a bass line under four guitars has to sound like a bass line.
 */
export function backingMelody(
  source: GuitarNightReferenceSource,
  selection: BackingPartSelection = {},
): GuitarRoomBandNote[] {
  const audible = selection.audibleTrackIds
  const notes: GuitarRoomBandNote[] = []

  for (const track of source.tracks) {
    if (track.notes.length === 0) continue
    if (track.id === selection.scoredTrackId) continue
    if (audible !== undefined && !audible.includes(track.id)) continue

    const variant = variantForTrack(source, track.id)
    for (const note of track.notes) {
      if (!Number.isFinite(note.midi) || !Number.isFinite(note.startBeat)) {
        continue
      }
      notes.push({
        midi: note.midi,
        startBeat: note.startBeat,
        durationBeats: Math.max(0, note.duration),
        variant,
      })
    }
  }

  return notes.sort((left, right) => left.startBeat - right.startBeat)
}

/**
 * Whether the scored part should sound as well. A tab with one part must keep
 * playing itself — muting the only part would leave nothing but the click.
 */
export function scoredPartSoundsByDefault(
  source: GuitarNightReferenceSource | null,
  scoredTrackId?: string,
): boolean {
  if (source === null) return true
  return backingParts(source, scoredTrackId).length === 0
}

function variantForTrack(
  source: GuitarNightReferenceSource,
  trackId: string,
): GuitarVariant {
  return suggestReferenceInstrument(source, trackId)?.instrument === 'bass'
    ? 'bass'
    : 'electric'
}
