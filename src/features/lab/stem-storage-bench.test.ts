// ============================================================
// Stem storage bench tests — WAV validity, integrity gate, runner shape
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { wavDurationSeconds, wavSampleRate } from '@/lib/wav-meta'
import type { StemStorageDriver } from './stem-storage-bench'
import { buildBenchWav, formatBenchRun, hashBytes, runStemStorageBench, } from './stem-storage-bench'

function memoryDriver(
  overrides: Partial<StemStorageDriver> = {},
): StemStorageDriver {
  const rows = new Map<string, ArrayBuffer>()
  return {
    id: 'array-buffer',
    label: 'memory',
    available: () => true,
    prepare: async () => undefined,
    write: async (name, wav) => {
      rows.set(name, wav)
    },
    read: async (name) => ({ value: rows.get(name)! }),
    clear: async () => rows.clear(),
    ...overrides,
  }
}

const HOOKS = {
  sampleMemory: async () => ({ pageBytes: null, jsHeapBytes: null }),
  now: (() => {
    let tick = 0
    return () => (tick += 1)
  })(),
  // jsdom object URLs are not fetchable and its Blob lacks arrayBuffer();
  // FileReader is the one byte-read path jsdom implements.
  readBack: (_url: string, blob: Blob) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error ?? new Error('read failed'))
      reader.readAsArrayBuffer(blob)
    }),
}

describe('buildBenchWav', () => {
  it('produces a parseable RIFF/WAVE of the requested size', () => {
    const wav = buildBenchWav(1024 * 1024, 7)

    expect(wav.byteLength).toBeLessThanOrEqual(1024 * 1024)
    expect(wav.byteLength).toBeGreaterThan(1024 * 1024 - 64)
    expect(wavSampleRate(wav)).toBe(44_100)
    // 1 MiB of 16-bit stereo at 44.1 kHz is a touch under six seconds.
    expect(wavDurationSeconds(wav)).toBeCloseTo(5.94, 1)
  })

  it('is deterministic per seed and distinct across seeds', async () => {
    const first = await hashBytes(buildBenchWav(64 * 1024, 1))

    expect(await hashBytes(buildBenchWav(64 * 1024, 1))).toBe(first)
    expect(await hashBytes(buildBenchWav(64 * 1024, 2))).not.toBe(first)
  })
})

describe('runStemStorageBench', () => {
  it('walks the read path and proves round-trip integrity', async () => {
    const run = await runStemStorageBench(
      memoryDriver(),
      { stemBytes: 64 * 1024, stemCount: 2, decode: false },
      HOOKS,
    )

    expect(run.stems).toHaveLength(2)
    expect(run.stems.every((stem) => stem.hashOk)).toBe(true)
    expect(run.stems.every((stem) => stem.decodeMs === null)).toBe(true)
    expect(run.checkpoints.map((point) => point.label)).toEqual([
      'baseline',
      'after-generate',
      'after-read-path',
    ])
  })

  it('flags a corrupting driver instead of trusting it', async () => {
    const run = await runStemStorageBench(
      memoryDriver({
        read: async () => ({ value: buildBenchWav(64 * 1024, 999) }),
      }),
      { stemBytes: 64 * 1024, stemCount: 1, decode: false },
      HOOKS,
    )

    expect(run.stems[0]?.hashOk).toBe(false)
  })

  it('times the decode step only when asked', async () => {
    const decode = vi.fn(async () => undefined)
    const run = await runStemStorageBench(
      memoryDriver(),
      { stemBytes: 32 * 1024, stemCount: 1, decode: true },
      { ...HOOKS, decode },
    )

    expect(decode).toHaveBeenCalledOnce()
    expect(run.stems[0]?.decodeMs).not.toBeNull()
  })
})

describe('formatBenchRun', () => {
  it('renders a markdown block with integrity verdicts', async () => {
    const run = await runStemStorageBench(
      memoryDriver(),
      { stemBytes: 32 * 1024, stemCount: 1, decode: false },
      HOOKS,
    )

    const markdown = formatBenchRun(run)
    expect(markdown).toContain('| stem | write | read row |')
    expect(markdown).toContain('| stem-1 |')
    expect(markdown).toContain('ok |')
    expect(markdown).toContain('| checkpoint | page memory | JS heap |')
  })
})
