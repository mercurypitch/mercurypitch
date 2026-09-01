// The rest of the band: the parts of a loaded score that are not the one being
// scored. Reported 2026-08-20 — "when I load a GP5 tab and select the track to
// score against there is no way to control the other tracks mute/hear, and by
// default all others are muted. But usually it should be other way around, we
// should play all but the scored against so user can play."
//
// So that is the default here: every other part sounds, and the part you are
// graded on is yours to play. Nothing in this file touches audio or the DOM —
// it turns a score into notes for the band and answers which parts are on.

import type { GuitarRoomBandNote, GuitarRoomBandPercussionHit, } from '@/features/guitar/backing/guitar-room-band'
import { drumVoiceForMidi } from '@/lib/drum-lanes'
import type { GuitarVariant } from '@/lib/guitar/guitar-synth'
import type { MidiProgramFamily } from '@/lib/midi-program-family'
import { resolveMidiProgramFamily } from '@/lib/midi-program-family'
import type { GuitarNightReferenceSource, GuitarNightReferenceSourceTrack, } from './reference-port'

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
export type BackingPart =
  | {
      trackId: string
      name: string
      kind: 'pitched'
      instrumentFamily: MidiProgramFamily
      noteCount: number
    }
  | {
      trackId: string
      name: string
      kind: 'percussion'
      hitCount: number
      supportedHitCount: number
      droppedHitCount: number
    }

/** Every part that could play under the scored one, in written order. */
export function backingParts(
  source: GuitarNightReferenceSource,
  scoredTrackId?: string,
): readonly BackingPart[] {
  const parts: BackingPart[] = []
  for (const track of source.tracks) {
    if (track.id === scoredTrackId) continue
    if (track.kind === 'percussion') {
      const hitCount = track.percussionHits?.length ?? 0
      const droppedHitCount = Math.max(0, track.droppedHitCount ?? 0)
      if (hitCount > 0 || droppedHitCount > 0) {
        parts.push({
          trackId: track.id,
          name: track.name,
          kind: 'percussion',
          hitCount,
          supportedHitCount: (track.percussionHits ?? []).filter(
            (hit) => drumVoiceForMidi(hit.gmKey) !== null,
          ).length,
          droppedHitCount,
        })
      }
      continue
    }
    if (track.notes.length === 0) continue
    parts.push({
      trackId: track.id,
      name: track.name,
      kind: 'pitched',
      instrumentFamily: instrumentFamilyForTrack(track),
      noteCount: track.notes.length,
    })
  }
  return parts
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
    if (track.kind === 'percussion') continue
    if (track.notes.length === 0) continue
    if (track.id === selection.scoredTrackId) continue
    if (audible !== undefined && !audible.includes(track.id)) continue

    const instrumentFamily = instrumentFamilyForTrack(track)
    const variant = variantForFamily(instrumentFamily)
    for (const note of track.notes) {
      if (!Number.isFinite(note.midi) || !Number.isFinite(note.startBeat)) {
        continue
      }
      const velocity =
        typeof note.velocity === 'number' &&
        Number.isInteger(note.velocity) &&
        note.velocity >= 1 &&
        note.velocity <= 127
          ? note.velocity
          : undefined
      notes.push({
        midi: note.midi,
        startBeat: note.startBeat,
        durationBeats: Math.max(0, note.duration),
        ...(variant === undefined ? {} : { variant }),
        instrumentFamily,
        ...(velocity === undefined ? {} : { velocity }),
        channelId: track.id,
      })
    }
  }

  return notes.sort((left, right) => left.startBeat - right.startBeat)
}

/** Authored drum attacks from every audible percussion part. */
export function backingPercussion(
  source: GuitarNightReferenceSource,
  selection: BackingPartSelection = {},
): GuitarRoomBandPercussionHit[] {
  const audible = selection.audibleTrackIds
  const hits: GuitarRoomBandPercussionHit[] = []

  for (const track of source.tracks) {
    if (track.kind !== 'percussion') continue
    if (track.id === selection.scoredTrackId) continue
    if (audible !== undefined && !audible.includes(track.id)) continue

    for (const hit of track.percussionHits ?? []) {
      if (
        !Number.isInteger(hit.gmKey) ||
        hit.gmKey < 35 ||
        hit.gmKey > 81 ||
        !Number.isFinite(hit.startBeat) ||
        hit.startBeat < 0 ||
        !Number.isInteger(hit.velocity) ||
        hit.velocity < 1 ||
        hit.velocity > 127
      ) {
        continue
      }
      hits.push({
        trackId: track.id,
        gmKey: hit.gmKey,
        startBeat: hit.startBeat,
        velocity: hit.velocity,
        ...(hit.id === undefined ? {} : { sourceId: hit.id }),
        ...(hit.articulation === undefined
          ? {}
          : { articulation: hit.articulation }),
      })
    }
  }

  return hits.sort((left, right) => left.startBeat - right.startBeat)
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
  return !backingParts(source, scoredTrackId).some(
    (part) => part.kind === 'pitched' || part.supportedHitCount > 0,
  )
}

function instrumentFamilyForTrack(
  track: GuitarNightReferenceSourceTrack,
): MidiProgramFamily {
  return resolveMidiProgramFamily(track)
}

function variantForFamily(
  instrumentFamily: MidiProgramFamily,
): GuitarVariant | undefined {
  if (instrumentFamily === 'acoustic-guitar') return 'acoustic'
  if (instrumentFamily === 'electric-guitar') return 'electric'
  if (instrumentFamily === 'bass') return 'bass'
  return undefined
}
