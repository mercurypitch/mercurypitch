// ============================================================
// Drum Night import — bounded, lazy, generation-safe file boundary
// ============================================================
//
// Parsers load only after a supported, bounded file is selected. Both source
// formats terminate in the canonical MidiSong model. A small controller owns
// selection generations so a slow older parse can never replace a newer one.

import type { MidiSong } from '@/lib/midi-song'
import type { DrumSessionImportSourceFormat, DrumSessionImportState, } from './drum-session'
import { drumSessionStateFromSong, IDLE_DRUM_SESSION, loadingDrumSession, } from './drum-session'
import { MAX_DRUM_SESSION_FILE_BYTES } from './drum-session-import-protocol'

export { MAX_DRUM_SESSION_FILE_BYTES }

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
    options?: DrumSessionParserOptions,
  ) => DrumSessionParserOutcome | Promise<DrumSessionParserOutcome>
  readonly parseGuitarPro?: (
    file: File,
    options?: DrumSessionParserOptions,
  ) => DrumSessionParserOutcome | Promise<DrumSessionParserOutcome>
  /** Test seam; production creates one lazy module Worker per attempt. */
  readonly importInWorker?: (
    file: File,
    format: DrumSessionImportSourceFormat,
    options?: DrumSessionImportOptions,
  ) => DrumSessionParserOutcome | Promise<DrumSessionParserOutcome>
}

export interface DrumSessionParserOptions {
  readonly signal?: AbortSignal
}

export interface DrumSessionImportOptions extends DrumSessionParserOptions {
  readonly timeoutMs?: number
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
      /** Parsed result for diagnostics, or idle when cancellation stopped it. */
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

function sourceFormat(fileName: string): DrumSessionImportSourceFormat | null {
  const extension = fileExtension(fileName)
  if (MIDI_EXTENSIONS.has(extension)) return 'midi'
  if (GUITAR_PRO_EXTENSIONS.has(extension)) return 'guitar-pro'
  return null
}

function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim()
  return withoutExtension === '' ? 'Imported drum part' : withoutExtension
}

async function defaultWorkerParser(
  file: File,
  format: DrumSessionImportSourceFormat,
  options: DrumSessionImportOptions,
): Promise<DrumSessionParserOutcome> {
  const { importDrumSessionInWorker } =
    await import('./drum-session-import-client')
  return importDrumSessionInWorker(file, format, options)
}

function abortError(): DOMException {
  return new DOMException('Drum session import was cancelled.', 'AbortError')
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function recoverableWorkerMessage(error: unknown): string | null {
  if (
    !(error instanceof Error) ||
    error.name !== 'DrumSessionImportError' ||
    !('code' in error)
  ) {
    return null
  }
  const code = error.code
  return code === 'TOO_COMPLEX' || code === 'TIMED_OUT' ? error.message : null
}

function formatName(format: DrumSessionImportSourceFormat): string {
  return format === 'midi' ? 'MIDI' : 'Guitar Pro'
}

function unreadableMessage(format: DrumSessionImportSourceFormat): string {
  return `No readable musical events were found in this ${formatName(format)} file. It may be empty, damaged, or unsupported by the parser. Export it again and retry.`
}

function malformedMessage(format: DrumSessionImportSourceFormat): string {
  return `This ${formatName(format)} file is malformed. Export a fresh copy and try again.`
}

function stateFromParserOutcome(options: {
  readonly outcome: DrumSessionParserOutcome
  readonly fileName: string
  readonly format: DrumSessionImportSourceFormat
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
  options: DrumSessionImportOptions = {},
): Promise<DrumSessionImportState> {
  throwIfAborted(options.signal)
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
    let outcome: DrumSessionParserOutcome
    if (format === 'midi' && ports.parseMidi !== undefined) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      throwIfAborted(options.signal)
      outcome = await ports.parseMidi(bytes, options)
    } else if (format === 'guitar-pro' && ports.parseGuitarPro !== undefined) {
      outcome = await ports.parseGuitarPro(file, options)
    } else {
      outcome = await (ports.importInWorker ?? defaultWorkerParser)(
        file,
        format,
        options,
      )
    }
    throwIfAborted(options.signal)
    return stateFromParserOutcome({ outcome, fileName: file.name, format })
  } catch (error) {
    if (isAbortError(error)) throw error
    const recoverableMessage = recoverableWorkerMessage(error)
    return {
      status: 'error',
      fileName: file.name,
      message: recoverableMessage ?? unreadableMessage(format),
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
  let activeImport: AbortController | null = null
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
      if (disposed) {
        return {
          status: 'stale',
          generation: currentGeneration,
          state: IDLE_DRUM_SESSION,
        }
      }
      const generation = ++currentGeneration
      activeImport?.abort()
      const abortController = new AbortController()
      activeImport = abortController
      commit(loadingDrumSession(file.name))
      let state: DrumSessionImportState
      try {
        state = await importDrumSession(file, ports, {
          signal: abortController.signal,
        })
      } catch (error) {
        if (
          isAbortError(error) &&
          (disposed || generation !== currentGeneration)
        ) {
          return { status: 'stale', generation, state: IDLE_DRUM_SESSION }
        }
        throw error
      } finally {
        if (activeImport === abortController) activeImport = null
      }
      if (disposed || generation !== currentGeneration) {
        return { status: 'stale', generation, state }
      }
      commit(state)
      return { status: 'applied', generation, state }
    },
    cancel(): void {
      currentGeneration += 1
      activeImport?.abort()
      activeImport = null
      if (!disposed) commit(IDLE_DRUM_SESSION)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      currentGeneration += 1
      activeImport?.abort()
      activeImport = null
      listeners.clear()
    },
  }
}
