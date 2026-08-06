// Session archive codec -- bounded streaming ZIP reads and validated v1 manifests.

import type { UnzipDecoder, UnzipDecoderConstructor, UnzipFile } from 'fflate'
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate'
import type { LyricsData } from '@/db/services/lyrics-db-service'
import type { SessionPitchData } from '@/db/services/session-pitch-analysis-service'
import type { PitchEditLayer } from '@/features/stem-mixer/pitch-edit-model'
import type { PitchNote, WordSweepTimingsMap, } from '@/features/stem-mixer/types'
import type { KeyRegion } from '@/lib/key-detection'
import type { MergedNote } from '@/lib/midi-generator'
import type { MelodyFingerprint } from '@/lib/shazam/types'
import type { WhisperSegment } from '@/lib/whisper-service'
import type { UvrSession } from '@/stores/uvr-store'

export const SESSION_ARCHIVE_LIMITS = {
  jsonEntryBytes: 8 * 1024 * 1024,
  audioEntryBytes: 512 * 1024 * 1024,
  selectedUncompressedBytes: 4 * 1024 * 1024 * 1024,
  entryCount: 4096,
  inputChunkBytes: 64 * 1024,
  pathBytes: 1024,
} as const

const SESSION_STATUSES = new Set<UvrSession['status']>([
  'idle',
  'uploading',
  'processing',
  'finalizing',
  'completed',
  'error',
  'cancelled',
  'interrupted',
])

const LYRIC_VERSION_KINDS = new Set([
  'imported',
  'edited',
  'auto-sync',
  'lrc-gen',
  'whisper',
])

export class SessionArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionArchiveError'
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

/** Reject traversal, absolute paths, control characters and ambiguous ZIP names. */
export function validateSessionArchivePath(path: string): string {
  if (path.length === 0 || path.length > SESSION_ARCHIVE_LIMITS.pathBytes) {
    throw new SessionArchiveError('Archive entry path has an invalid length')
  }
  if (hasControlCharacter(path) || path.includes('\\')) {
    throw new SessionArchiveError(`Unsafe archive entry path: ${path}`)
  }
  if (path.startsWith('/') || /^[a-z]:/i.test(path)) {
    throw new SessionArchiveError(`Absolute archive entry path: ${path}`)
  }

  const directory = path.endsWith('/')
  const segments = (directory ? path.slice(0, -1) : path).split('/')
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment.length > 255 ||
        segment === '.' ||
        segment === '..',
    )
  ) {
    throw new SessionArchiveError(`Unsafe archive entry path: ${path}`)
  }
  return path
}

export function isSafeSessionArchivePath(path: string): boolean {
  try {
    validateSessionArchivePath(path)
    return true
  } catch {
    return false
  }
}

export type SessionArchiveEntryKind = 'json' | 'audio'

export interface SessionArchiveEntryInfo {
  path: string
  kind: SessionArchiveEntryKind
  compressedSize?: number
  uncompressedSize?: number
}

export interface SessionArchiveEntry extends SessionArchiveEntryInfo {
  /** One size-capped inflated entry; handlers consume entries in ZIP order. */
  blob: Blob
  size: number
}

export interface ReadSessionArchiveOptions {
  /** Called before inflation; return false to skip an otherwise recognized entry. */
  select?: (entry: SessionArchiveEntryInfo) => boolean
  /** Awaited in archive order before more compressed input is consumed. */
  onEntry: (entry: SessionArchiveEntry) => Promise<void> | void
}

/** Start a known ZIP stream with a no-op decoder. fflate otherwise retains
 * every compressed chunk for files whose `start()` is never called, defeating
 * manifest-only inspection of audio-heavy archives. */
function discardArchiveFile(unzip: Unzip, file: UnzipFile): void {
  if (
    file.compression !== UnzipPassThrough.compression &&
    file.compression !== UnzipInflate.compression
  ) {
    throw new SessionArchiveError(
      `Unsupported ZIP compression method ${file.compression}`,
    )
  }

  class DiscardDecoder implements UnzipDecoder {
    static compression = file.compression
    ondata: UnzipDecoder['ondata'] = () => undefined

    push(_chunk: Uint8Array, final: boolean): void {
      if (final) this.ondata(null, new Uint8Array(0), true)
    }
  }

  unzip.register(DiscardDecoder as UnzipDecoderConstructor)
  file.ondata = () => undefined
  file.start()
  unzip.register(
    file.compression === UnzipInflate.compression
      ? UnzipInflate
      : UnzipPassThrough,
  )
}

function classifyEntry(path: string): SessionArchiveEntryKind | null {
  if (
    path === 'karaoke.json' ||
    path.endsWith('/session.json') ||
    path === 'session.json'
  ) {
    return 'json'
  }
  const basename = path.split('/').pop() ?? ''
  if (/^original_.+/i.test(basename)) return 'audio'
  if (/^stem_.+\.[a-z0-9.+-]+$/i.test(basename)) return 'audio'
  return null
}

async function* blobInputChunks(blob: Blob): AsyncGenerator<Uint8Array> {
  if (typeof blob.stream === 'function') {
    const reader = blob.stream().getReader()
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) return
        for (
          let offset = 0;
          offset < result.value.byteLength;
          offset += SESSION_ARCHIVE_LIMITS.inputChunkBytes
        ) {
          yield result.value.subarray(
            offset,
            offset + SESSION_ARCHIVE_LIMITS.inputChunkBytes,
          )
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  for (
    let offset = 0;
    offset < blob.size;
    offset += SESSION_ARCHIVE_LIMITS.inputChunkBytes
  ) {
    const slice = blob.slice(
      offset,
      offset + SESSION_ARCHIVE_LIMITS.inputChunkBytes,
    )
    if (typeof slice.arrayBuffer === 'function') {
      yield new Uint8Array(await slice.arrayBuffer())
      continue
    }
    if (typeof FileReader === 'undefined') {
      throw new SessionArchiveError(
        'This browser cannot stream the selected archive',
      )
    }
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () =>
        reject(reader.error ?? new Error('Archive chunk could not be read'))
      reader.readAsArrayBuffer(slice)
    })
    yield new Uint8Array(bytes)
  }
}

/**
 * Stream recognized archive entries with per-entry and cumulative inflation
 * limits. The reader applies backpressure between compressed chunks and
 * serializes async entry handlers. The caller still owns the compressed Blob.
 */
export async function readSessionArchiveEntries(
  archive: Blob,
  options: ReadSessionArchiveOptions,
): Promise<void> {
  let entryCount = 0
  let selectedBytes = 0
  let handlerQueue = Promise.resolve()
  let streamError: Error | null = null

  const fail = (error: unknown): never => {
    const normalized =
      error instanceof Error ? error : new SessionArchiveError(String(error))
    streamError ??= normalized
    throw normalized
  }

  const unzip = new Unzip((file) => {
    try {
      entryCount++
      if (entryCount > SESSION_ARCHIVE_LIMITS.entryCount) {
        fail(
          `Archive contains more than ${SESSION_ARCHIVE_LIMITS.entryCount} entries`,
        )
      }
      const path = validateSessionArchivePath(file.name)
      if (path.endsWith('/')) {
        discardArchiveFile(unzip, file)
        return
      }
      const kind = classifyEntry(path)
      if (kind === null) {
        discardArchiveFile(unzip, file)
        return
      }

      const info: SessionArchiveEntryInfo = {
        path,
        kind,
        compressedSize: file.size,
        uncompressedSize: file.originalSize,
      }
      if (options.select?.(info) === false) {
        discardArchiveFile(unzip, file)
        return
      }

      const entryLimit =
        kind === 'json'
          ? SESSION_ARCHIVE_LIMITS.jsonEntryBytes
          : SESSION_ARCHIVE_LIMITS.audioEntryBytes
      if (file.originalSize !== undefined && file.originalSize > entryLimit) {
        fail(`${kind} archive entry exceeds its size limit: ${path}`)
      }

      let entryBytes = 0
      const chunks: BlobPart[] = []
      file.ondata = (error, chunk, final) => {
        if (error !== null) fail(error)
        entryBytes += chunk.byteLength
        selectedBytes += chunk.byteLength
        if (entryBytes > entryLimit) {
          file.terminate()
          fail(`${kind} archive entry exceeds its size limit: ${path}`)
        }
        if (selectedBytes > SESSION_ARCHIVE_LIMITS.selectedUncompressedBytes) {
          file.terminate()
          fail('Selected archive data exceeds the uncompressed size limit')
        }
        if (chunk.byteLength > 0) {
          const retained = chunk.slice()
          chunks.push(retained.buffer as ArrayBuffer)
        }
        if (!final) return

        const entry: SessionArchiveEntry = {
          ...info,
          blob: new Blob(chunks),
          size: entryBytes,
          uncompressedSize: entryBytes,
        }
        handlerQueue = handlerQueue.then(() => options.onEntry(entry))
      }
      file.start()
    } catch (error) {
      fail(error)
    }
  })
  unzip.register(UnzipInflate)

  let pushedAny = false
  for await (const chunk of blobInputChunks(archive)) {
    if (streamError !== null) throw streamError
    pushedAny = true
    unzip.push(chunk, false)
    await handlerQueue
  }
  if (!pushedAny) throw new SessionArchiveError('Archive is empty')
  unzip.push(new Uint8Array(0), true)
  await handlerQueue
  if (streamError !== null) throw streamError
  if (entryCount === 0)
    throw new SessionArchiveError('Archive contains no readable entries')
}

type ArchivedUvrSession = Pick<
  UvrSession,
  | 'sessionId'
  | 'status'
  | 'progress'
  | 'createdAt'
  | 'indeterminate'
  | 'phase'
  | 'processingTime'
  | 'splitTime'
  | 'error'
  | 'fileHash'
  | 'originalFile'
  | 'stemMeta'
  | 'processingMode'
  | 'provider'
  | 'numChunks'
  | 'bandSplit'
>

export interface ParsedSessionArchivePayload {
  version: 1
  session: ArchivedUvrSession
  lyrics: LyricsData | null
  transcription: WhisperSegment[] | null
  pitchAnalysis: SessionPitchData | null
  fingerprint: MelodyFingerprint | null
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SessionArchiveError(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function stringValue(value: unknown, field: string, maxLength = 4096): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new SessionArchiveError(`${field} must be a bounded string`)
  }
  return value
}

function finiteNumber(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new SessionArchiveError(`${field} must be a finite number`)
  }
  return value
}

function optionalNumber(
  source: Record<string, unknown>,
  key: string,
  minimum = 0,
): number | undefined {
  const value = source[key]
  return value === undefined ? undefined : finiteNumber(value, key, minimum)
}

function optionalString(
  source: Record<string, unknown>,
  key: string,
  maxLength = 4096,
): string | undefined {
  const value = source[key]
  return value === undefined ? undefined : stringValue(value, key, maxLength)
}

function sanitizeFilename(name: string): string {
  const basename = name.replace(/\\/g, '/').split('/').pop() ?? ''
  const safe = [...basename]
    .map((character) =>
      hasControlCharacter(character) || character === '/' || character === '\\'
        ? '_'
        : character,
    )
    .join('')
    .replace(/^\.+/, '_')
    .trim()
  return safe === '' ? 'audio.wav' : safe.slice(0, 255)
}

function parseSession(value: unknown): ArchivedUvrSession {
  const source = record(value, 'session')
  const sessionId = stringValue(source.sessionId, 'session.sessionId', 256)
  if (sessionId.trim() === '' || hasControlCharacter(sessionId)) {
    throw new SessionArchiveError('session.sessionId is invalid')
  }
  if (!SESSION_STATUSES.has(source.status as UvrSession['status'])) {
    throw new SessionArchiveError('session.status is invalid')
  }
  const progress = finiteNumber(source.progress, 'session.progress')
  if (progress > 100)
    throw new SessionArchiveError('session.progress exceeds 100')

  const session: ArchivedUvrSession = {
    sessionId,
    status: source.status as UvrSession['status'],
    progress,
    createdAt: finiteNumber(source.createdAt, 'session.createdAt'),
  }
  if (source.indeterminate !== undefined) {
    if (typeof source.indeterminate !== 'boolean')
      throw new SessionArchiveError('session.indeterminate must be boolean')
    session.indeterminate = source.indeterminate
  }
  if (source.phase !== undefined) {
    if (source.phase !== 'queued' && source.phase !== 'processing')
      throw new SessionArchiveError('session.phase is invalid')
    session.phase = source.phase
  }
  session.processingTime = optionalNumber(source, 'processingTime')
  session.splitTime = optionalNumber(source, 'splitTime')
  session.error = optionalString(source, 'error', 8192)
  session.fileHash = optionalString(source, 'fileHash', 256)
  if (source.originalFile !== undefined) {
    const original = record(source.originalFile, 'session.originalFile')
    const mimeType = stringValue(
      original.mimeType,
      'originalFile.mimeType',
      128,
    )
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType)) {
      throw new SessionArchiveError('originalFile.mimeType is invalid')
    }
    const size = finiteNumber(original.size, 'originalFile.size')
    if (size > SESSION_ARCHIVE_LIMITS.audioEntryBytes)
      throw new SessionArchiveError('originalFile.size exceeds the audio limit')
    session.originalFile = {
      name: sanitizeFilename(
        stringValue(original.name, 'originalFile.name', 1024),
      ),
      size,
      mimeType,
    }
  }
  if (source.stemMeta !== undefined) {
    const metadata = record(source.stemMeta, 'session.stemMeta')
    if (Object.keys(metadata).length > 32)
      throw new SessionArchiveError('session.stemMeta has too many entries')
    const stemMeta: NonNullable<UvrSession['stemMeta']> = {}
    for (const [stem, rawMeta] of Object.entries(metadata)) {
      if (!/^[a-z0-9_-]{1,64}$/i.test(stem))
        throw new SessionArchiveError('session.stemMeta has an invalid key')
      const meta = record(rawMeta, `session.stemMeta.${stem}`)
      stemMeta[stem] = {
        ...(meta.duration !== undefined
          ? { duration: finiteNumber(meta.duration, 'stem duration') }
          : {}),
        ...(meta.size !== undefined
          ? { size: finiteNumber(meta.size, 'stem size') }
          : {}),
      }
    }
    session.stemMeta = stemMeta
  }
  if (source.processingMode !== undefined) {
    if (source.processingMode !== 'local' && source.processingMode !== 'server')
      throw new SessionArchiveError('session.processingMode is invalid')
    session.processingMode = source.processingMode
  }
  session.provider = optionalString(source, 'provider', 128)
  if (source.numChunks !== undefined) {
    const count = finiteNumber(source.numChunks, 'session.numChunks')
    if (!Number.isInteger(count) || count > 100_000)
      throw new SessionArchiveError('session.numChunks is invalid')
    session.numChunks = count
  }
  if (source.bandSplit !== undefined) {
    if (typeof source.bandSplit !== 'boolean')
      throw new SessionArchiveError('session.bandSplit must be boolean')
    session.bandSplit = source.bandSplit
  }
  return session
}

function parseWordTimings(
  value: unknown,
  field: string,
): LyricsData['wordTimings'] {
  const source = record(value, field)
  const result: NonNullable<LyricsData['wordTimings']> = {}
  for (const [line, rawTimes] of Object.entries(source)) {
    if (!/^\d{1,8}$/.test(line) || !Array.isArray(rawTimes))
      throw new SessionArchiveError(`${field} is malformed`)
    result[Number(line)] = rawTimes.map((time) => {
      if (time === null) return undefined
      return finiteNumber(time, `${field}.${line}`)
    })
  }
  return result
}

function parseWordSweepTimings(
  value: unknown,
  field: string,
): WordSweepTimingsMap {
  const source = record(value, field)
  const result: WordSweepTimingsMap = {}
  for (const [line, rawWords] of Object.entries(source)) {
    if (!/^\d{1,8}$/.test(line))
      throw new SessionArchiveError(`${field} is malformed`)
    const words = record(rawWords, `${field}.${line}`)
    const parsedWords: WordSweepTimingsMap[number] = {}
    for (const [word, rawPoints] of Object.entries(words)) {
      if (!/^\d{1,8}$/.test(word) || !Array.isArray(rawPoints))
        throw new SessionArchiveError(`${field} is malformed`)
      parsedWords[Number(word)] = rawPoints.map((rawPoint, pointIndex) => {
        const point = record(rawPoint, `${field}.${line}.${word}.${pointIndex}`)
        const progress = finiteNumber(point.progress, 'word sweep progress')
        if (progress > 1)
          throw new SessionArchiveError('word sweep progress exceeds 1')
        return {
          time: finiteNumber(point.time, 'word sweep time'),
          progress,
        }
      })
    }
    result[Number(line)] = parsedWords
  }
  return result
}

function parseLyrics(value: unknown): LyricsData | null {
  if (value === null || value === undefined) return null
  const source = record(value, 'lyrics')
  if (source.format !== 'txt' && source.format !== 'lrc')
    throw new SessionArchiveError('lyrics.format is invalid')
  const lyrics: LyricsData = {
    text: stringValue(
      source.text,
      'lyrics.text',
      SESSION_ARCHIVE_LIMITS.jsonEntryBytes,
    ),
    format: source.format,
    filename: sanitizeFilename(
      stringValue(source.filename, 'lyrics.filename', 1024),
    ),
  }
  if (source.wordTimings !== undefined)
    lyrics.wordTimings = parseWordTimings(
      source.wordTimings,
      'lyrics.wordTimings',
    )
  if (source.originalText !== undefined)
    lyrics.originalText = stringValue(
      source.originalText,
      'lyrics.originalText',
      SESSION_ARCHIVE_LIMITS.jsonEntryBytes,
    )
  if (source.fontSize !== undefined)
    lyrics.fontSize = finiteNumber(source.fontSize, 'lyrics.fontSize')
  if (source.activeVersionKind !== undefined) {
    const kind = stringValue(
      source.activeVersionKind,
      'lyrics.activeVersionKind',
      32,
    )
    if (!LYRIC_VERSION_KINDS.has(kind))
      throw new SessionArchiveError('lyrics.activeVersionKind is invalid')
    lyrics.activeVersionKind = kind as NonNullable<
      LyricsData['activeVersionKind']
    >
  }
  if (source.blocks !== undefined) {
    if (!Array.isArray(source.blocks) || source.blocks.length > 10_000)
      throw new SessionArchiveError('lyrics.blocks is malformed')
    lyrics.blocks = source.blocks.map((rawBlock, index) => {
      const block = record(rawBlock, `lyrics.blocks.${index}`)
      if (!Array.isArray(block.lineIndices))
        throw new SessionArchiveError('lyrics block lineIndices is malformed')
      return {
        id: stringValue(block.id, 'lyrics block id', 256),
        label: stringValue(block.label, 'lyrics block label', 1024),
        lineIndices: block.lineIndices.map((line) => {
          const parsed = finiteNumber(line, 'lyrics block line')
          if (!Number.isInteger(parsed))
            throw new SessionArchiveError(
              'lyrics block line must be an integer',
            )
          return parsed
        }),
        repeatCount: finiteNumber(
          block.repeatCount,
          'lyrics block repeatCount',
        ),
      }
    })
  }
  if (source.blockInstances !== undefined) {
    const instances = record(source.blockInstances, 'lyrics.blockInstances')
    const parsed: Record<string, number[][]> = {}
    for (const [key, rawLists] of Object.entries(instances)) {
      if (!Array.isArray(rawLists))
        throw new SessionArchiveError('lyrics.blockInstances is malformed')
      parsed[key] = rawLists.map((rawList) => {
        if (!Array.isArray(rawList))
          throw new SessionArchiveError('lyrics.blockInstances is malformed')
        return rawList.map((line) => {
          const number = finiteNumber(line, 'lyrics block instance')
          if (!Number.isInteger(number))
            throw new SessionArchiveError(
              'lyrics block instance must be an integer',
            )
          return number
        })
      })
    }
    lyrics.blockInstances = parsed
  }
  if (source.versions !== undefined) {
    if (!Array.isArray(source.versions) || source.versions.length > 16)
      throw new SessionArchiveError('lyrics.versions is malformed')
    lyrics.versions = source.versions.map((rawVersion, index) => {
      const version = record(rawVersion, `lyrics.versions.${index}`)
      const kind = stringValue(version.kind, 'lyrics version kind', 32)
      if (!LYRIC_VERSION_KINDS.has(kind))
        throw new SessionArchiveError('lyrics version kind is invalid')
      return {
        kind: kind as NonNullable<LyricsData['activeVersionKind']>,
        text: stringValue(
          version.text,
          'lyrics version text',
          SESSION_ARCHIVE_LIMITS.jsonEntryBytes,
        ),
        createdAt: finiteNumber(version.createdAt, 'lyrics version createdAt'),
        ...(version.wordTimings !== undefined
          ? {
              wordTimings: parseWordTimings(
                version.wordTimings,
                'lyrics version wordTimings',
              ) as Record<number, number[]>,
            }
          : {}),
        ...(version.wordEndTimings !== undefined
          ? {
              wordEndTimings: parseWordTimings(
                version.wordEndTimings,
                'lyrics version wordEndTimings',
              ) as Record<number, number[]>,
            }
          : {}),
        ...(version.wordSweepTimings !== undefined
          ? {
              wordSweepTimings: parseWordSweepTimings(
                version.wordSweepTimings,
                'lyrics version wordSweepTimings',
              ),
            }
          : {}),
      }
    })
  }
  return lyrics
}

function parseTranscription(value: unknown): WhisperSegment[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value) || value.length > 200_000)
    throw new SessionArchiveError('transcription is malformed')
  return value.map((rawSegment, index) => {
    const segment = record(rawSegment, `transcription.${index}`)
    if (!Array.isArray(segment.timestamp) || segment.timestamp.length !== 2)
      throw new SessionArchiveError('transcription timestamp is malformed')
    const start = finiteNumber(segment.timestamp[0], 'transcription start')
    const end = finiteNumber(segment.timestamp[1], 'transcription end')
    if (end < start)
      throw new SessionArchiveError('transcription timestamp is reversed')
    return {
      text: stringValue(segment.text, 'transcription text', 4096),
      timestamp: [start, end],
    }
  })
}

function parseMergedNotes(value: unknown, field: string): MergedNote[] {
  if (!Array.isArray(value) || value.length > 500_000)
    throw new SessionArchiveError(`${field} is malformed`)
  return value.map((rawNote, index) => {
    const note = record(rawNote, `${field}.${index}`)
    const startSec = finiteNumber(note.startSec, `${field}.startSec`)
    const endSec = finiteNumber(note.endSec, `${field}.endSec`)
    if (endSec < startSec)
      throw new SessionArchiveError(`${field} note is reversed`)
    const midi = finiteNumber(note.midi, `${field}.midi`)
    if (midi > 127) throw new SessionArchiveError(`${field}.midi is invalid`)
    return {
      midi,
      noteName: stringValue(note.noteName, `${field}.noteName`, 32),
      startSec,
      endSec,
    }
  })
}

function parsePitchHistory(value: unknown): PitchNote[] {
  if (!Array.isArray(value) || value.length > 2_000_000)
    throw new SessionArchiveError('pitchAnalysis.pitchHistory is malformed')
  return value.map((rawPoint, index) => {
    const point = record(rawPoint, `pitchAnalysis.pitchHistory.${index}`)
    return {
      time: finiteNumber(point.time, 'pitch point time'),
      noteName: stringValue(point.noteName, 'pitch point noteName', 32),
      frequency: finiteNumber(point.frequency, 'pitch point frequency'),
      octave: finiteNumber(point.octave, 'pitch point octave', -2),
    }
  })
}

function parseEditLayer(value: unknown): PitchEditLayer {
  const source = record(value, 'pitchAnalysis.editLayer')
  if (!Array.isArray(source.manual) || !Array.isArray(source.deleted))
    throw new SessionArchiveError('pitchAnalysis.editLayer is malformed')
  const manual = source.manual.map((rawNote, index) => {
    const note = record(rawNote, `editLayer.manual.${index}`)
    const startBeat = finiteNumber(note.startBeat, 'edit note startBeat')
    const endBeat = finiteNumber(note.endBeat, 'edit note endBeat')
    const midi = finiteNumber(note.midi, 'edit note midi')
    if (endBeat < startBeat || midi > 127)
      throw new SessionArchiveError('edit note is invalid')
    return {
      id: stringValue(note.id, 'edit note id', 128),
      startBeat,
      endBeat,
      midi,
    }
  })
  const deleted = source.deleted.map((rawSpan, index) => {
    const span = record(rawSpan, `editLayer.deleted.${index}`)
    const startBeat = finiteNumber(span.startBeat, 'edit span startBeat')
    const endBeat = finiteNumber(span.endBeat, 'edit span endBeat')
    if (endBeat < startBeat)
      throw new SessionArchiveError('edit span is reversed')
    return { startBeat, endBeat }
  })
  const seq = finiteNumber(source.seq, 'editLayer.seq')
  if (!Number.isInteger(seq))
    throw new SessionArchiveError('editLayer.seq is invalid')
  return { manual, deleted, seq }
}

function parseKeyRegions(value: unknown): KeyRegion[] {
  if (!Array.isArray(value) || value.length > 100_000)
    throw new SessionArchiveError('pitchAnalysis.keyRegions is malformed')
  return value.map((rawRegion, index) => {
    const region = record(rawRegion, `pitchAnalysis.keyRegions.${index}`)
    const mode = region.mode
    if (mode !== 'major' && mode !== 'minor')
      throw new SessionArchiveError('pitchAnalysis key mode is invalid')
    const tonic = finiteNumber(region.tonic, 'key region tonic')
    const confidence = finiteNumber(region.confidence, 'key region confidence')
    const startSec = finiteNumber(region.startSec, 'key region startSec')
    const endSec = finiteNumber(region.endSec, 'key region endSec')
    if (tonic > 11 || confidence > 1 || endSec < startSec)
      throw new SessionArchiveError('pitchAnalysis key region is invalid')
    return {
      tonic,
      mode,
      confidence,
      keyName: stringValue(region.keyName, 'key region keyName', 32),
      scaleType: stringValue(region.scaleType, 'key region scaleType', 32),
      startSec,
      endSec,
    }
  })
}

function parsePitchAnalysis(value: unknown): SessionPitchData | null {
  if (value === null || value === undefined) return null
  const source = record(value, 'pitchAnalysis')
  const data: SessionPitchData = {
    segmentedNotes: parseMergedNotes(
      source.segmentedNotes,
      'pitchAnalysis.segmentedNotes',
    ),
    mergedNotes: parseMergedNotes(
      source.mergedNotes,
      'pitchAnalysis.mergedNotes',
    ),
    pitchHistory: parsePitchHistory(source.pitchHistory),
  }
  if (source.editLayer !== undefined)
    data.editLayer = parseEditLayer(source.editLayer)
  if (source.keyRegions !== undefined)
    data.keyRegions = parseKeyRegions(source.keyRegions)
  return data
}

function parseFingerprintSequence(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  requireInteger = false,
): number[] {
  if (!Array.isArray(value) || value.length > 500_000) {
    throw new SessionArchiveError(`${field} is malformed`)
  }
  return value.map((candidate) => {
    if (
      typeof candidate !== 'number' ||
      !Number.isFinite(candidate) ||
      candidate < minimum ||
      candidate > maximum ||
      (requireInteger && !Number.isInteger(candidate))
    ) {
      throw new SessionArchiveError(`${field} contains an invalid number`)
    }
    return candidate
  })
}

function parseFingerprint(value: unknown): MelodyFingerprint | null {
  if (value === null || value === undefined) return null
  const source = record(value, 'fingerprint')
  const noteCount = finiteNumber(source.noteCount, 'fingerprint.noteCount')
  if (!Number.isInteger(noteCount) || noteCount > 500_000) {
    throw new SessionArchiveError('fingerprint.noteCount is invalid')
  }
  const pitchSequence = parseFingerprintSequence(
    source.pitchSequence,
    'fingerprint.pitchSequence',
    0,
    127,
    true,
  )
  const durations = parseFingerprintSequence(
    source.durations,
    'fingerprint.durations',
    0,
    Number.MAX_VALUE,
  )
  const chromaSequence = parseFingerprintSequence(
    source.chromaSequence,
    'fingerprint.chromaSequence',
    0,
    11,
    true,
  )
  const ioiSequence = parseFingerprintSequence(
    source.ioiSequence,
    'fingerprint.ioiSequence',
    0,
    Number.MAX_VALUE,
  )
  const intervalSequence = parseFingerprintSequence(
    source.intervalSequence,
    'fingerprint.intervalSequence',
    -127,
    127,
    true,
  )
  if (
    pitchSequence.length !== noteCount ||
    durations.length !== noteCount ||
    chromaSequence.length !== noteCount ||
    ioiSequence.length > Math.max(0, noteCount - 1) ||
    intervalSequence.length > Math.max(0, noteCount - 1)
  ) {
    throw new SessionArchiveError('fingerprint sequence lengths are invalid')
  }
  const bpm = finiteNumber(source.bpm, 'fingerprint.bpm')
  if (bpm === 0) throw new SessionArchiveError('fingerprint.bpm is invalid')
  return {
    melodyId: stringValue(source.melodyId, 'fingerprint.melodyId', 512),
    name: stringValue(source.name, 'fingerprint.name', 1024),
    pitchSequence,
    ioiSequence,
    durations,
    durationSec: finiteNumber(source.durationSec, 'fingerprint.durationSec'),
    noteCount,
    ...(source.firstNoteStartSec !== undefined
      ? {
          firstNoteStartSec: finiteNumber(
            source.firstNoteStartSec,
            'fingerprint.firstNoteStartSec',
          ),
        }
      : {}),
    chromaSequence,
    intervalSequence,
    bpm,
    key: stringValue(source.key, 'fingerprint.key', 64),
  }
}

export function parseSessionArchivePayload(
  value: unknown,
): ParsedSessionArchivePayload {
  const source = record(value, 'session archive payload')
  if (source.version !== 1)
    throw new SessionArchiveError('Unsupported session archive version')
  return {
    version: 1,
    session: parseSession(source.session),
    lyrics: parseLyrics(source.lyrics),
    transcription: parseTranscription(source.transcription),
    pitchAnalysis: parsePitchAnalysis(source.pitchAnalysis),
    fingerprint: parseFingerprint(source.fingerprint),
  }
}

export function parseSessionArchivePayloadJson(
  json: string,
): ParsedSessionArchivePayload {
  try {
    return parseSessionArchivePayload(JSON.parse(json) as unknown)
  } catch (error) {
    if (error instanceof SessionArchiveError) throw error
    throw new SessionArchiveError('Session manifest is not valid JSON')
  }
}

export interface ArchivedKaraokeGroup {
  id: string
  name: string
  sessionIds: string[]
}

export interface ArchivedKaraokePlaylistItem {
  id?: string
  kind: 'session' | 'group'
  refId: string
  singerName?: string
  shuffleWithinGroup?: boolean
  vocalVolume?: number
}

export interface ArchivedKaraokePlaylist {
  id: string
  name: string
  items: ArchivedKaraokePlaylistItem[]
  shuffleOrder?: boolean
  playMode?: 'sequential' | 'roundRobin'
}

export interface ParsedKaraokeArchiveManifest {
  version: 1
  playlists: ArchivedKaraokePlaylist[]
  groups: ArchivedKaraokeGroup[]
}

function opaqueId(value: unknown, field: string): string {
  const id = stringValue(value, field, 256)
  if (id.trim() === '' || hasControlCharacter(id))
    throw new SessionArchiveError(`${field} is invalid`)
  return id
}

export function parseKaraokeArchiveManifest(
  value: unknown,
): ParsedKaraokeArchiveManifest {
  const source = record(value, 'karaoke manifest')
  if (source.version !== 1)
    throw new SessionArchiveError('Unsupported karaoke archive version')
  if (!Array.isArray(source.groups) || !Array.isArray(source.playlists))
    throw new SessionArchiveError('Karaoke manifest lists are malformed')
  if (source.groups.length > 4096 || source.playlists.length > 4096)
    throw new SessionArchiveError('Karaoke manifest contains too many records')

  const groups = source.groups.map((rawGroup, index) => {
    const group = record(rawGroup, `groups.${index}`)
    if (!Array.isArray(group.sessionIds) || group.sessionIds.length > 100_000)
      throw new SessionArchiveError('Karaoke group sessions are malformed')
    return {
      id: opaqueId(group.id, 'group.id'),
      name: stringValue(group.name, 'group.name', 512),
      sessionIds: group.sessionIds.map((id) => opaqueId(id, 'group.sessionId')),
    }
  })

  const playlists = source.playlists.map((rawPlaylist, index) => {
    const playlist = record(rawPlaylist, `playlists.${index}`)
    if (!Array.isArray(playlist.items) || playlist.items.length > 100_000)
      throw new SessionArchiveError('Karaoke playlist items are malformed')
    const items = playlist.items.map((rawItem, itemIndex) => {
      const item = record(rawItem, `playlists.${index}.items.${itemIndex}`)
      if (item.kind !== 'session' && item.kind !== 'group')
        throw new SessionArchiveError('Karaoke playlist item kind is invalid')
      const parsed: ArchivedKaraokePlaylistItem = {
        kind: item.kind,
        refId: opaqueId(item.refId, 'playlist item refId'),
      }
      if (item.id !== undefined)
        parsed.id = opaqueId(item.id, 'playlist item id')
      if (item.singerName !== undefined)
        parsed.singerName = stringValue(
          item.singerName,
          'playlist singerName',
          512,
        )
      if (item.shuffleWithinGroup !== undefined) {
        if (typeof item.shuffleWithinGroup !== 'boolean')
          throw new SessionArchiveError(
            'playlist shuffleWithinGroup is invalid',
          )
        parsed.shuffleWithinGroup = item.shuffleWithinGroup
      }
      if (item.vocalVolume !== undefined) {
        const volume = finiteNumber(item.vocalVolume, 'playlist vocalVolume')
        if (volume > 1)
          throw new SessionArchiveError('playlist vocalVolume exceeds 1')
        parsed.vocalVolume = volume
      }
      return parsed
    })
    const parsed: ArchivedKaraokePlaylist = {
      id: opaqueId(playlist.id, 'playlist.id'),
      name: stringValue(playlist.name, 'playlist.name', 512),
      items,
    }
    if (playlist.shuffleOrder !== undefined) {
      if (typeof playlist.shuffleOrder !== 'boolean')
        throw new SessionArchiveError('playlist shuffleOrder is invalid')
      parsed.shuffleOrder = playlist.shuffleOrder
    }
    if (playlist.playMode !== undefined) {
      if (
        playlist.playMode !== 'sequential' &&
        playlist.playMode !== 'roundRobin'
      )
        throw new SessionArchiveError('playlist playMode is invalid')
      parsed.playMode = playlist.playMode
    }
    return parsed
  })

  return { version: 1, groups, playlists }
}

export function parseKaraokeArchiveManifestJson(
  json: string,
): ParsedKaraokeArchiveManifest {
  try {
    return parseKaraokeArchiveManifest(JSON.parse(json) as unknown)
  } catch (error) {
    if (error instanceof SessionArchiveError) throw error
    throw new SessionArchiveError('Karaoke manifest is not valid JSON')
  }
}
