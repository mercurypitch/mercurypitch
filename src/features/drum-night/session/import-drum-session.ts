// ============================================================
// Drum Night import — bounded, lazy, generation-safe file boundary
// ============================================================
//
// Parsers load only after a supported, bounded file is selected. Both source
// formats terminate in the canonical MidiSong model. A small controller owns
// selection generations so a slow older parse can never replace a newer one.

import type { MidiSong } from '@/lib/midi-song'
import type { DrumSessionImportState, DrumSessionSourceFormat, } from './drum-session'
import { drumSessionStateFromSong, IDLE_DRUM_SESSION, loadingDrumSession, } from './drum-session'

export const MAX_DRUM_SESSION_FILE_BYTES = 20 * 1024 * 1024

export type DrumSessionParserOutcome =
  | {
      readonly status: 'parsed'
      readonly song: MidiSong
      /** Source metadata title, when the parser can prove one. */
      readonly name?: string
    }
  | { readonly status: 'empty' }
  | { readonly status: 'malformed'; readonly message?: string }
  | { readonly status: 'unreadable' }

export interface DrumSessionImportPorts {
  readonly parseMidi?: (
    bytes: Uint8Array,
  ) => DrumSessionParserOutcome | Promise<DrumSessionParserOutcome>
  readonly parseGuitarPro?: (
    file: File,
  ) => DrumSessionParserOutcome | Promise<DrumSessionParserOutcome>
}

export type DrumSessionImportAttempt =
  | {
      readonly status: 'applied'
      readonly generation: number
      readonly state: DrumSessionImportState
    }
  | {
      readonly status: 'stale'
      readonly generation: number
      /** Parsed result for diagnostics only; it was not committed. */
      readonly state: DrumSessionImportState
    }

export interface DrumSessionImportController {
  state(): DrumSessionImportState
  generation(): number
  subscribe(listener: () => void): () => void
  importFile(file: File): Promise<DrumSessionImportAttempt>
  cancel(): void
  dispose(): void
}

const MIDI_EXTENSIONS = new Set(['mid', 'midi'])
const GUITAR_PRO_EXTENSIONS = new Set(['gp', 'gp3', 'gp4', 'gp5', 'gpx'])

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase()
}

function sourceFormat(fileName: string): DrumSessionSourceFormat | null {
  const extension = fileExtension(fileName)
  if (MIDI_EXTENSIONS.has(extension)) return 'midi'
  if (GUITAR_PRO_EXTENSIONS.has(extension)) return 'guitar-pro'
  return null
}

function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim()
  return withoutExtension === '' ? 'Imported drum part' : withoutExtension
}

async function defaultMidiParser(
  bytes: Uint8Array,
): Promise<DrumSessionParserOutcome> {
  const { parseMidiSong } = await import('@/lib/midi-song')
  const song = parseMidiSong(bytes)
  // The shared parser currently returns null for both a valid eventless SMF
  // and malformed bytes. Do not pretend to know which one occurred.
  return song === null ? { status: 'unreadable' } : { status: 'parsed', song }
}

async function defaultGuitarProParser(
  file: File,
): Promise<DrumSessionParserOutcome> {
  try {
    const { parseGuitarProFile } = await import('@/lib/tab/gp-import')
    const parsed = await parseGuitarProFile(file)
    return { status: 'parsed', song: parsed.song, name: parsed.name }
  } catch {
    // alphaTab's public boundary does not distinguish an empty score from a
    // damaged file, so the caller receives deliberately conservative copy.
    return { status: 'unreadable' }
  }
}

function formatName(format: DrumSessionSourceFormat): string {
  return format === 'midi' ? 'MIDI' : 'Guitar Pro'
}

function unreadableMessage(format: DrumSessionSourceFormat): string {
  return `No readable musical events were found in this ${formatName(format)} file. It may be empty, damaged, or unsupported by the parser. Export it again and retry.`
}

function malformedMessage(format: DrumSessionSourceFormat): string {
  return `This ${formatName(format)} file is malformed. Export a fresh copy and try again.`
}

function stateFromParserOutcome(options: {
  readonly outcome: DrumSessionParserOutcome
  readonly fileName: string
  readonly format: DrumSessionSourceFormat
}): DrumSessionImportState {
  switch (options.outcome.status) {
    case 'parsed': {
      const parsedName = options.outcome.name?.trim()
      return drumSessionStateFromSong({
        song: options.outcome.song,
        title:
          parsedName !== undefined && parsedName !== ''
            ? parsedName
            : titleFromFileName(options.fileName),
        fileName: options.fileName,
        sourceFormat: options.format,
      })
    }
    case 'empty':
      return { status: 'empty', fileName: options.fileName }
    case 'malformed': {
      const parserMessage = options.outcome.message?.trim()
      return {
        status: 'error',
        fileName: options.fileName,
        message:
          parserMessage !== undefined && parserMessage !== ''
            ? parserMessage
            : malformedMessage(options.format),
      }
    }
    case 'unreadable':
      return {
        status: 'error',
        fileName: options.fileName,
        message: unreadableMessage(options.format),
      }
  }
}

/** Read one user-selected file through the shared canonical parser path. */
export async function importDrumSession(
  file: File,
  ports: DrumSessionImportPorts = {},
): Promise<DrumSessionImportState> {
  const format = sourceFormat(file.name)
  if (format === null) {
    return {
      status: 'unsupported',
      fileName: file.name,
      reason: 'file-type',
      droppedHitCount: 0,
    }
  }
  if (file.size > MAX_DRUM_SESSION_FILE_BYTES) {
    return {
      status: 'too-large',
      fileName: file.name,
      actualBytes: file.size,
      maximumBytes: MAX_DRUM_SESSION_FILE_BYTES,
    }
  }
  if (file.size === 0) return { status: 'empty', fileName: file.name }

  try {
    const outcome =
      format === 'midi'
        ? await (ports.parseMidi ?? defaultMidiParser)(
            new Uint8Array(await file.arrayBuffer()),
          )
        : await (ports.parseGuitarPro ?? defaultGuitarProParser)(file)
    return stateFromParserOutcome({ outcome, fileName: file.name, format })
  } catch {
    return {
      status: 'error',
      fileName: file.name,
      message: unreadableMessage(format),
    }
  }
}

/** Own import generations so only the newest selected file may commit state. */
export function createDrumSessionImportController(
  ports: DrumSessionImportPorts = {},
): DrumSessionImportController {
  const listeners = new Set<() => void>()
  let currentState: DrumSessionImportState = IDLE_DRUM_SESSION
  let currentGeneration = 0
  let disposed = false

  const emit = (): void => {
    for (const listener of listeners) listener()
  }
  const commit = (state: DrumSessionImportState): void => {
    currentState = state
    emit()
  }

  return {
    state: () => currentState,
    generation: () => currentGeneration,
    subscribe(listener: () => void): () => void {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async importFile(file: File): Promise<DrumSessionImportAttempt> {
      const generation = ++currentGeneration
      commit(loadingDrumSession(file.name))
      const state = await importDrumSession(file, ports)
      if (disposed || generation !== currentGeneration) {
        return { status: 'stale', generation, state }
      }
      commit(state)
      return { status: 'applied', generation, state }
    },
    cancel(): void {
      currentGeneration += 1
      if (!disposed) commit(IDLE_DRUM_SESSION)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      currentGeneration += 1
      listeners.clear()
    },
  }
}
