// ============================================================
// Drum session import protocol — bounded one-shot Worker messages
// ============================================================
//
// The file, not an already-read buffer, crosses this boundary. Production
// parsing therefore stays off the UI thread and a cancelled attempt can be
// stopped by terminating its one owning Worker.

import type { MidiSong } from '@/lib/midi-song'
import type { DrumSessionImportSourceFormat } from './drum-session'
import type { DrumSessionParserOutcome } from './import-drum-session'

export const MAX_DRUM_SESSION_FILE_BYTES = 20 * 1024 * 1024
export const MAX_DRUM_SESSION_SOURCE_EVENTS = 131_072
export const MAX_DRUM_SESSION_MUSICAL_EVENTS = 32_768
export const MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS = 4_096
export const MAX_DRUM_SESSION_TEXT_CHARACTERS = 1024 * 1024
export const MAX_DRUM_SESSION_DETAIL_POINTS = 131_072

export type DrumSessionPayloadLimitKind =
  | 'TEXT_FIELD'
  | 'TEXT_TOTAL'
  | 'DETAIL_POINTS'

/** A whole-import rejection used before a canonical song crosses the Worker boundary. */
export class DrumSessionPayloadLimitError extends Error {
  readonly name = 'DrumSessionPayloadLimitError'

  constructor(
    readonly kind: DrumSessionPayloadLimitKind,
    readonly maximum: number,
  ) {
    const subject =
      kind === 'TEXT_FIELD'
        ? 'an authored text field longer than'
        : kind === 'TEXT_TOTAL'
          ? 'more authored text than'
          : 'more bend contour points than'
    super(
      `This file contains ${subject} the safe limit of ${maximum.toLocaleString()}. Nothing was truncated or partially loaded. Export a simpler part and retry.`,
    )
  }
}

/** Reject clone-heavy authored metadata/details without modifying the song. */
export function assertBoundedDrumSessionPayload(
  song: MidiSong,
  importedName?: string,
): void {
  let textCharacters = 0
  let detailPoints = 0

  const addText = (value: string | undefined): void => {
    if (value === undefined) return
    if (value.length > MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS) {
      throw new DrumSessionPayloadLimitError(
        'TEXT_FIELD',
        MAX_DRUM_SESSION_TEXT_FIELD_CHARACTERS,
      )
    }
    textCharacters += value.length
    if (textCharacters > MAX_DRUM_SESSION_TEXT_CHARACTERS) {
      throw new DrumSessionPayloadLimitError(
        'TEXT_TOTAL',
        MAX_DRUM_SESSION_TEXT_CHARACTERS,
      )
    }
  }

  addText(importedName)
  for (const track of song.tracks) {
    addText(track.name)
    addText(track.instrumentName)
    if (track.kind === 'percussion') {
      for (const hit of track.percussionHits) addText(hit.source?.label)
      continue
    }
    addText(track.sourceTuningName)
    for (const note of track.notes) {
      addText(note.notation?.chordLabel)
      for (const technique of note.notation?.techniques ?? []) {
        if (technique.kind !== 'bend') continue
        detailPoints += technique.points?.length ?? 0
        if (detailPoints > MAX_DRUM_SESSION_DETAIL_POINTS) {
          throw new DrumSessionPayloadLimitError(
            'DETAIL_POINTS',
            MAX_DRUM_SESSION_DETAIL_POINTS,
          )
        }
      }
    }
  }
}

export type DrumSessionWorkerSourceFormat = DrumSessionImportSourceFormat

export interface DrumSessionImportWorkerRequest {
  readonly type: 'IMPORT_DRUM_SESSION'
  readonly requestId: string
  readonly file: File
  readonly format: DrumSessionWorkerSourceFormat
}

export type DrumSessionImportWorkerResponse =
  | {
      readonly type: 'DRUM_SESSION_IMPORTED'
      readonly requestId: string
      readonly outcome: DrumSessionParserOutcome
    }
  | {
      readonly type: 'DRUM_SESSION_IMPORT_ERROR'
      readonly requestId: string
      readonly code: string
      readonly message: string
    }
