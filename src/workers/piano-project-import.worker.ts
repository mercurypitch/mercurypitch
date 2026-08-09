// ============================================================
// PianoProject import Worker — bounded file read, hash, and pure SMF parse
// ============================================================
//
// The File crosses the Worker boundary before its bytes are read. This keeps
// malformed or oversized imports away from the UI thread and ensures the size
// gate runs before file.arrayBuffer() allocates the source payload.

import { parseMidiProject, PIANO_PROJECT_PARSE_LIMITS, PianoProjectParseError, } from '@/features/piano-project/parse-midi-project'
import type { PianoProject } from '@/features/piano-project/piano-project'

export interface PianoProjectImportWorkerRequest {
  type: 'IMPORT_PIANO_PROJECT'
  requestId: string
  file: File
}

export type PianoProjectImportWorkerResponse =
  | {
      type: 'PIANO_PROJECT_IMPORTED'
      requestId: string
      project: PianoProject
    }
  | {
      type: 'PIANO_PROJECT_IMPORT_ERROR'
      requestId: string
      code: string
      message: string
    }

function bytesToHex(bytes: Uint8Array): string {
  let result = ''
  for (const byte of bytes) result += byte.toString(16).padStart(2, '0')
  return result
}

function projectName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.(?:mid|midi)$/i, '').trim()
  return withoutExtension === '' ? 'Untitled MIDI project' : withoutExtension
}

class PianoProjectWorkerError extends Error {
  constructor(
    readonly code: 'NO_NOTES',
    message: string,
  ) {
    super(message)
  }
}

async function importProject(file: File): Promise<PianoProject> {
  if (file.size > PIANO_PROJECT_PARSE_LIMITS.maxFileBytes) {
    throw new PianoProjectParseError(
      'FILE_TOO_LARGE',
      `MIDI files may contain at most ${PIANO_PROJECT_PARSE_LIMITS.maxFileBytes.toLocaleString()} bytes.`,
    )
  }

  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const sha256 = bytesToHex(new Uint8Array(digest))
  const importedAt = new Date().toISOString()
  const project = parseMidiProject(new Uint8Array(buffer), {
    id: `piano-project-${sha256.slice(0, 24)}`,
    name: projectName(file.name),
    fileName: file.name,
    sha256,
    importedAt,
  })
  if (project.scoreTrackId === null) {
    throw new PianoProjectWorkerError(
      'NO_NOTES',
      'No pitched playable notes were found in this MIDI file.',
    )
  }
  return project
}

self.onmessage = (event: MessageEvent<PianoProjectImportWorkerRequest>) => {
  if (event.data.type !== 'IMPORT_PIANO_PROJECT') return
  const { file, requestId } = event.data

  void importProject(file)
    .then((project) => {
      self.postMessage({
        type: 'PIANO_PROJECT_IMPORTED',
        requestId,
        project,
      } satisfies PianoProjectImportWorkerResponse)
    })
    .catch((error: unknown) => {
      self.postMessage({
        type: 'PIANO_PROJECT_IMPORT_ERROR',
        requestId,
        code:
          error instanceof PianoProjectParseError ||
          error instanceof PianoProjectWorkerError
            ? error.code
            : 'IMPORT_FAILED',
        message: error instanceof Error ? error.message : String(error),
      } satisfies PianoProjectImportWorkerResponse)
    })
}
