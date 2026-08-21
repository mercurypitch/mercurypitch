// ============================================================
// Drum session import Worker — bounded MIDI and Guitar Pro projection
// ============================================================
//
// Parsing and canonical projection happen here so a supported local file can
// never monopolise the UI thread. The caller owns this Worker for one attempt;
// terminating it is the cancellation primitive.

import type { DrumSessionImportWorkerRequest, DrumSessionImportWorkerResponse, } from '@/features/drum-night/session/drum-session-import-protocol'
import { assertBoundedDrumSessionPayload, DrumSessionPayloadLimitError, MAX_DRUM_SESSION_FILE_BYTES, MAX_DRUM_SESSION_MUSICAL_EVENTS, MAX_DRUM_SESSION_SOURCE_EVENTS, } from '@/features/drum-night/session/drum-session-import-protocol'
import type { DrumSessionParserOutcome } from '@/features/drum-night/session/import-drum-session'
import { parseMidiProject, PianoProjectParseError, } from '@/features/piano-project/parse-midi-project'
import type { MidiSong } from '@/lib/midi-song'
import { gmInstrumentName } from '@/lib/midi-song'
import { midiSongFromProject } from '@/lib/midi-song-from-project'

class DrumSessionWorkerError extends Error {
  constructor(
    readonly code: 'FILE_TOO_LARGE' | 'TOO_COMPLEX',
    message: string,
  ) {
    super(message)
  }
}

function musicalEventCount(song: MidiSong): number {
  let count =
    (song.tempoChanges?.length ?? 0) + (song.timeSignatures?.length ?? 0)
  for (const track of song.tracks) {
    count +=
      track.kind === 'percussion'
        ? track.percussionHits.length + track.droppedHitCount
        : track.notes.length
  }
  return count
}

function assertBoundedSong(song: MidiSong, importedName?: string): void {
  const eventCount = musicalEventCount(song)
  if (eventCount > MAX_DRUM_SESSION_MUSICAL_EVENTS) {
    throw new DrumSessionWorkerError(
      'TOO_COMPLEX',
      `This file contains ${eventCount.toLocaleString()} musical events; Drum Night opens at most ${MAX_DRUM_SESSION_MUSICAL_EVENTS.toLocaleString()}. Nothing was truncated or partially loaded. Export a shorter part and retry.`,
    )
  }
  try {
    assertBoundedDrumSessionPayload(song, importedName)
  } catch (error) {
    if (error instanceof DrumSessionPayloadLimitError) {
      throw new DrumSessionWorkerError('TOO_COMPLEX', error.message)
    }
    throw error
  }
}

async function parseMidi(file: File): Promise<DrumSessionParserOutcome> {
  const buffer = await file.arrayBuffer()
  let project
  try {
    project = parseMidiProject(
      new Uint8Array(buffer),
      {
        id: 'transient-drum-session',
        name: file.name,
        fileName: file.name,
        sha256: '',
        importedAt: '1970-01-01T00:00:00.000Z',
      },
      { maxEvents: MAX_DRUM_SESSION_SOURCE_EVENTS },
    )
  } catch (error) {
    if (
      error instanceof PianoProjectParseError &&
      error.code === 'TOO_MANY_EVENTS'
    ) {
      throw new DrumSessionWorkerError(
        'TOO_COMPLEX',
        `${error.message} Nothing was truncated or partially loaded. Export a shorter part and retry.`,
      )
    }
    if (error instanceof PianoProjectParseError) {
      return { status: 'malformed', message: error.message }
    }
    throw error
  }

  const song = midiSongFromProject(project, gmInstrumentName)
  if (song === null) return { status: 'empty' }
  assertBoundedSong(song)
  return { status: 'parsed', song }
}

async function parseGuitarPro(file: File): Promise<DrumSessionParserOutcome> {
  const { GpSongProjectionLimitError, parseGuitarProFile } =
    await import('@/lib/tab/gp-import')
  try {
    const parsed = await parseGuitarProFile(file, {
      maximumEvents: MAX_DRUM_SESSION_MUSICAL_EVENTS,
    })
    assertBoundedSong(parsed.song, parsed.name)
    return { status: 'parsed', song: parsed.song, name: parsed.name }
  } catch (error) {
    if (error instanceof DrumSessionWorkerError) throw error
    if (error instanceof GpSongProjectionLimitError) {
      throw new DrumSessionWorkerError(
        'TOO_COMPLEX',
        `${error.message} Nothing was truncated or partially loaded. Export a shorter part and retry.`,
      )
    }
    return { status: 'unreadable' }
  }
}

async function importSession(
  request: DrumSessionImportWorkerRequest,
): Promise<DrumSessionParserOutcome> {
  if (request.file.size > MAX_DRUM_SESSION_FILE_BYTES) {
    throw new DrumSessionWorkerError(
      'FILE_TOO_LARGE',
      `Drum session files may contain at most ${MAX_DRUM_SESSION_FILE_BYTES.toLocaleString()} bytes.`,
    )
  }
  if (request.file.size === 0) return { status: 'empty' }
  return request.format === 'midi'
    ? parseMidi(request.file)
    : parseGuitarPro(request.file)
}

self.onmessage = (event: MessageEvent<DrumSessionImportWorkerRequest>) => {
  if (event.data.type !== 'IMPORT_DRUM_SESSION') return
  const request = event.data

  void importSession(request)
    .then((outcome) => {
      self.postMessage({
        type: 'DRUM_SESSION_IMPORTED',
        requestId: request.requestId,
        outcome,
      } satisfies DrumSessionImportWorkerResponse)
    })
    .catch((error: unknown) => {
      self.postMessage({
        type: 'DRUM_SESSION_IMPORT_ERROR',
        requestId: request.requestId,
        code:
          error instanceof DrumSessionWorkerError
            ? error.code
            : 'IMPORT_FAILED',
        message: error instanceof Error ? error.message : String(error),
      } satisfies DrumSessionImportWorkerResponse)
    })
}
