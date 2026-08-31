// ============================================================
// Stem storage bench — measured answers for the Blob migration plan
// ============================================================
//
// Phase 0 of docs/superpowers/plans/2026-08-30-stem-blob-storage.md. Every
// number the plan needs is produced here, on the real storage engines of the
// browser being tested, with synthetic stems — never user audio.
//
// Three drivers store the same generated WAVs three ways: as ArrayBuffer rows
// (today's uvrStemBlobs shape), as Blob rows (the proposed shape), and as OPFS
// files (the fallback candidate). The runner then walks the exact production
// read path — row read, object-URL mint, fetch back to bytes, optional
// decode — timing each step and sampling memory between them.
//
// Deliberately raw IndexedDB in its own throwaway database: the bench must
// measure the engine, not Dexie, and must never touch real stem rows.

export type StemStorageDriverId = 'array-buffer' | 'blob' | 'opfs'

export interface StemStorageBenchConfig {
  readonly stemBytes: number
  readonly stemCount: number
  /** Full decodeAudioData per stem — slow (seconds per stem), so opt-in. */
  readonly decode: boolean
}

export interface StemBenchMemorySample {
  /** Renderer-wide estimate when cross-origin isolated, else null. */
  readonly pageBytes: number | null
  /** Chrome-only JS heap. Misses blob storage and AudioBuffers — a stem that
   * "disappears" from this number may simply live outside the heap. */
  readonly jsHeapBytes: number | null
}

export interface StemBenchCheckpoint {
  readonly label: string
  readonly memory: StemBenchMemorySample
}

export interface StemBenchStemResult {
  readonly name: string
  readonly writeMs: number
  readonly readMs: number
  readonly urlMs: number
  readonly fetchMs: number
  readonly decodeMs: number | null
  readonly hashOk: boolean
}

export interface StemBenchRun {
  readonly driver: StemStorageDriverId
  readonly config: StemStorageBenchConfig
  readonly stems: readonly StemBenchStemResult[]
  readonly checkpoints: readonly StemBenchCheckpoint[]
  readonly totalMs: number
}

/** What a driver hands back for one stored stem. */
export interface StemStorageReadValue {
  /** The stored value as read: bytes today, a handle for Blob/OPFS. */
  readonly value: ArrayBuffer | Blob
}

export interface StemStorageDriver {
  readonly id: StemStorageDriverId
  readonly label: string
  available(): boolean
  prepare(): Promise<void>
  write(name: string, wav: ArrayBuffer): Promise<void>
  read(name: string): Promise<StemStorageReadValue>
  /** Remove everything the driver stored. Safe to call repeatedly. */
  clear(): Promise<void>
}

// ------------------------------------------------------------------
// Synthetic WAV
// ------------------------------------------------------------------

const WAV_HEADER_BYTES = 44
const WAV_SAMPLE_RATE = 44_100
const WAV_CHANNELS = 2
const WAV_BYTES_PER_SAMPLE = 2

/** Local PRNG so the bench owns its determinism without feature imports. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A valid 16-bit stereo RIFF/WAVE buffer of approximately `sizeBytes`,
 * filled with seeded noise over a slow sine so it neither compresses to
 * silence in blob storage nor clips. Parseable by `wavDurationSeconds`.
 */
export function buildBenchWav(sizeBytes: number, seed: number): ArrayBuffer {
  const frameBytes = WAV_CHANNELS * WAV_BYTES_PER_SAMPLE
  const frames = Math.max(
    1,
    Math.floor((sizeBytes - WAV_HEADER_BYTES) / frameBytes),
  )
  const dataBytes = frames * frameBytes
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)
  const writeTag = (offset: number, tag: string): void => {
    for (let index = 0; index < 4; index += 1) {
      view.setUint8(offset + index, tag.charCodeAt(index))
    }
  }
  writeTag(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeTag(8, 'WAVE')
  writeTag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, WAV_CHANNELS, true)
  view.setUint32(24, WAV_SAMPLE_RATE, true)
  view.setUint32(28, WAV_SAMPLE_RATE * frameBytes, true) // byte rate
  view.setUint16(32, frameBytes, true) // block align
  view.setUint16(34, 8 * WAV_BYTES_PER_SAMPLE, true)
  writeTag(36, 'data')
  view.setUint32(40, dataBytes, true)

  const random = mulberry32(seed)
  const samples = new Int16Array(
    buffer,
    WAV_HEADER_BYTES,
    frames * WAV_CHANNELS,
  )
  for (let frame = 0; frame < frames; frame += 1) {
    const tone = Math.sin((frame / WAV_SAMPLE_RATE) * 220 * 2 * Math.PI) * 0.2
    for (let channel = 0; channel < WAV_CHANNELS; channel += 1) {
      const noise = (random() * 2 - 1) * 0.3
      samples[frame * WAV_CHANNELS + channel] = Math.round(
        (tone + noise) * 0x5fff,
      )
    }
  }
  return buffer
}

// ------------------------------------------------------------------
// Integrity + memory sampling
// ------------------------------------------------------------------

export async function hashBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

interface MeasurableWindowPerformance {
  measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>
  memory?: { usedJSHeapSize: number }
}

export async function sampleBenchMemory(): Promise<StemBenchMemorySample> {
  const perf = performance as unknown as MeasurableWindowPerformance
  let pageBytes: number | null = null
  if (
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated &&
    typeof perf.measureUserAgentSpecificMemory === 'function'
  ) {
    try {
      pageBytes = (await perf.measureUserAgentSpecificMemory()).bytes
    } catch {
      pageBytes = null
    }
  }
  const jsHeapBytes =
    typeof perf.memory?.usedJSHeapSize === 'number'
      ? perf.memory.usedJSHeapSize
      : null
  return { pageBytes, jsHeapBytes }
}

// ------------------------------------------------------------------
// Drivers
// ------------------------------------------------------------------

const BENCH_DB_NAME = 'mercurypitch-stem-bench'
const BENCH_STORE = 'stems'

function openBenchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(BENCH_DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(BENCH_STORE)) {
        request.result.createObjectStore(BENCH_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('open failed'))
  })
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('request failed'))
  })
}

async function idbPut(name: string, value: unknown): Promise<void> {
  const db = await openBenchDb()
  try {
    const tx = db.transaction(BENCH_STORE, 'readwrite')
    await idbRequest(tx.objectStore(BENCH_STORE).put(value, name))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('tx failed'))
    })
  } finally {
    db.close()
  }
}

async function idbGet(name: string): Promise<unknown> {
  const db = await openBenchDb()
  try {
    const tx = db.transaction(BENCH_STORE, 'readonly')
    return await idbRequest(tx.objectStore(BENCH_STORE).get(name))
  } finally {
    db.close()
  }
}

function deleteBenchDb(): Promise<void> {
  return new Promise((resolve) => {
    const request = globalThis.indexedDB.deleteDatabase(BENCH_DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

/** Today's shape: the row IS the bytes; reading materializes the payload. */
export const arrayBufferDriver: StemStorageDriver = {
  id: 'array-buffer',
  label: 'ArrayBuffer rows (today)',
  available: () => typeof globalThis.indexedDB !== 'undefined',
  prepare: async () => undefined,
  write: (name, wav) => idbPut(`ab:${name}`, wav),
  read: async (name) => ({
    value: (await idbGet(`ab:${name}`)) as ArrayBuffer,
  }),
  clear: deleteBenchDb,
}

/** Proposed shape: the row is a handle; bytes stay in blob storage on read. */
export const blobDriver: StemStorageDriver = {
  id: 'blob',
  label: 'Blob rows (proposed)',
  available: () => typeof globalThis.indexedDB !== 'undefined',
  prepare: async () => undefined,
  write: (name, wav) =>
    idbPut(`blob:${name}`, new Blob([wav], { type: 'audio/wav' })),
  read: async (name) => ({ value: (await idbGet(`blob:${name}`)) as Blob }),
  clear: deleteBenchDb,
}

const OPFS_DIR = 'stem-bench'

async function opfsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(OPFS_DIR, { create: true })
}

/** The fallback candidate: real files, handle reads, lazy slicing. */
export const opfsDriver: StemStorageDriver = {
  id: 'opfs',
  label: 'OPFS files (alternative)',
  available: () =>
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function',
  prepare: async () => {
    await opfsDir()
  },
  write: async (name, wav) => {
    const dir = await opfsDir()
    const file = await dir.getFileHandle(`${name}.wav`, { create: true })
    const writable = await file.createWritable()
    await writable.write(wav)
    await writable.close()
  },
  read: async (name) => {
    const dir = await opfsDir()
    const file = await dir.getFileHandle(`${name}.wav`)
    // A File is a Blob: the read hands back a handle, exactly like blobDriver.
    return { value: await file.getFile() }
  },
  clear: async () => {
    try {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(OPFS_DIR, { recursive: true })
    } catch {
      // Never created, or already gone.
    }
  },
}

export const STEM_STORAGE_DRIVERS: readonly StemStorageDriver[] = [
  arrayBufferDriver,
  blobDriver,
  opfsDriver,
]

// ------------------------------------------------------------------
// Runner
// ------------------------------------------------------------------

export interface StemBenchHooks {
  /** Injectable for tests; defaults to the real sampler. */
  readonly sampleMemory?: () => Promise<StemBenchMemorySample>
  /** Injectable clock for tests; defaults to performance.now. */
  readonly now?: () => number
  /** Decode a fetched stem; defaults to a shared AudioContext decode. */
  readonly decode?: (bytes: ArrayBuffer) => Promise<unknown>
  /** Read the minted URL back to bytes; defaults to fetch — the production
   * path. Injectable because jsdom's object URLs are not fetchable. */
  readonly readBack?: (url: string, blob: Blob) => Promise<ArrayBuffer>
  readonly onProgress?: (message: string) => void
}

let benchAudioContext: AudioContext | null = null

async function defaultDecode(bytes: ArrayBuffer): Promise<unknown> {
  benchAudioContext ??= new AudioContext()
  return benchAudioContext.decodeAudioData(bytes)
}

/**
 * Walk one driver through the production read path. The generated WAVs are
 * hashed before storage and re-hashed after the fetch step, so the run also
 * proves round-trip integrity — the plan's hard gate.
 */
export async function runStemStorageBench(
  driver: StemStorageDriver,
  config: StemStorageBenchConfig,
  hooks: StemBenchHooks = {},
): Promise<StemBenchRun> {
  const now = hooks.now ?? (() => performance.now())
  const sampleMemory = hooks.sampleMemory ?? sampleBenchMemory
  const decode = hooks.decode ?? defaultDecode
  const readBack =
    hooks.readBack ?? (async (url: string) => (await fetch(url)).arrayBuffer())
  const progress = hooks.onProgress ?? (() => undefined)
  const checkpoints: StemBenchCheckpoint[] = []
  const checkpoint = async (label: string): Promise<void> => {
    checkpoints.push({ label, memory: await sampleMemory() })
  }

  const startedAt = now()
  await driver.prepare()
  await checkpoint('baseline')

  // Generate + hash first so synthesis never pollutes the write timing.
  progress('Generating stems')
  const sources: { name: string; wav: ArrayBuffer; hash: string }[] = []
  for (let index = 0; index < config.stemCount; index += 1) {
    const wav = buildBenchWav(config.stemBytes, 0xbe9c + index)
    sources.push({
      name: `stem-${index + 1}`,
      wav,
      hash: await hashBytes(wav),
    })
  }
  await checkpoint('after-generate')

  const stems: StemBenchStemResult[] = []
  for (const source of sources) {
    progress(`Writing ${source.name}`)
    const writeStart = now()
    await driver.write(source.name, source.wav)
    const writeMs = now() - writeStart

    progress(`Reading ${source.name}`)
    const readStart = now()
    const { value } = await driver.read(source.name)
    const readMs = now() - readStart

    // The production URL mint: a stored ArrayBuffer pays new Blob() here — a
    // full copy — while a stored Blob (or OPFS File) mints for free.
    const urlStart = now()
    const asBlob =
      value instanceof Blob ? value : new Blob([value], { type: 'audio/wav' })
    const url = URL.createObjectURL(asBlob)
    const urlMs = now() - urlStart

    progress(`Fetching ${source.name}`)
    const fetchStart = now()
    const fetched = await readBack(url, asBlob)
    const fetchMs = now() - fetchStart
    URL.revokeObjectURL(url)

    const hashOk = (await hashBytes(fetched)) === source.hash

    let decodeMs: number | null = null
    if (config.decode) {
      progress(`Decoding ${source.name}`)
      const decodeStart = now()
      // The fetched buffer is this iteration's last user, so decoding may
      // detach it — same in-place discipline the players use.
      await decode(fetched)
      decodeMs = now() - decodeStart
    }

    stems.push({
      name: source.name,
      writeMs,
      readMs,
      urlMs,
      fetchMs,
      decodeMs,
      hashOk,
    })
  }
  await checkpoint('after-read-path')

  return {
    driver: driver.id,
    config,
    stems,
    checkpoints,
    totalMs: now() - startedAt,
  }
}

// ------------------------------------------------------------------
// Reporting
// ------------------------------------------------------------------

function ms(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} ms`
}

function mib(value: number | null): string {
  return value === null ? '—' : `${(value / (1024 * 1024)).toFixed(1)} MiB`
}

/** Markdown block the plan document can absorb verbatim. */
export function formatBenchRun(run: StemBenchRun): string {
  const config = `${run.config.stemCount} × ${mib(run.config.stemBytes)} stems`
  const rows = run.stems.map(
    (stem) =>
      `| ${stem.name} | ${ms(stem.writeMs)} | ${ms(stem.readMs)} | ${ms(
        stem.urlMs,
      )} | ${ms(stem.fetchMs)} | ${ms(stem.decodeMs)} | ${
        stem.hashOk ? 'ok' : 'CORRUPT'
      } |`,
  )
  const memory = run.checkpoints.map(
    (point) =>
      `| ${point.label} | ${mib(point.memory.pageBytes)} | ${mib(
        point.memory.jsHeapBytes,
      )} |`,
  )
  return [
    `### ${run.driver} — ${config}, total ${ms(run.totalMs)}`,
    '',
    '| stem | write | read row | mint URL | fetch | decode | integrity |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '| checkpoint | page memory | JS heap |',
    '|---|---|---|',
    ...memory,
  ].join('\n')
}
