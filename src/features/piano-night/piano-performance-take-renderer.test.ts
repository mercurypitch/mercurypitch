// ============================================================
// Piano performance take renderer tests — deterministic player-only WAV
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoPerformanceTakeCapture } from './piano-performance-take'
import { PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS, PIANO_PERFORMANCE_TAKE_MAX_NOTES, } from './piano-performance-take'
import { PIANO_PERFORMANCE_TAKE_SAMPLE_RATE, renderPianoPerformanceTake, } from './piano-performance-take-renderer'

function readBlob(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })
}

function capture(): PianoPerformanceTakeCapture {
  return Object.freeze({
    durationMs: 180,
    inputKinds: Object.freeze(['touch'] as const),
    notes: Object.freeze([
      Object.freeze({
        id: 'touch:1',
        midi: 60,
        velocity: 0.8,
        softPedalValue: 0.2,
        releaseVelocity: 0.3,
        inputKind: 'touch' as const,
        startMs: 20,
        endMs: 150,
      }),
    ]),
  })
}

describe('renderPianoPerformanceTake', () => {
  it('renders a bounded mono WAV and compact waveform peaks', async () => {
    const rendered = renderPianoPerformanceTake(
      capture(),
      '2026-08-31T12:00:00.000Z',
    )

    expect(rendered).not.toBeNull()
    if (rendered === null) return
    expect(rendered.blob.type).toBe('audio/wav')
    expect(rendered.durationMs).toBe(285)
    expect(rendered.peaks).toHaveLength(72)
    expect(Math.max(...rendered.peaks)).toBeCloseTo(1)
    const bytes = await readBlob(rendered.blob)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE')
    expect(bytes.length).toBe(
      44 + Math.ceil(0.285 * PIANO_PERFORMANCE_TAKE_SAMPLE_RATE) * 2,
    )
  })

  it('produces byte-identical output for the same player event stream', async () => {
    const first = renderPianoPerformanceTake(capture(), 'first')
    const second = renderPianoPerformanceTake(capture(), 'second')

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    if (first === null || second === null) return
    expect(await readBlob(first.blob)).toEqual(await readBlob(second.blob))
  })

  it('rejects invalid bounds before creating output', () => {
    expect(
      renderPianoPerformanceTake(
        {
          ...capture(),
          durationMs: PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS + 1,
        },
        'now',
      ),
    ).toBeNull()
    expect(
      renderPianoPerformanceTake(
        {
          ...capture(),
          notes: Array.from(
            { length: PIANO_PERFORMANCE_TAKE_MAX_NOTES + 1 },
            () => capture().notes[0]!,
          ),
        },
        'now',
      ),
    ).toBeNull()
    expect(
      renderPianoPerformanceTake(
        {
          durationMs: PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS,
          inputKinds: ['touch'],
          notes: Array.from({ length: 7 }, (_, index) => ({
            ...capture().notes[0]!,
            id: `long-${index}`,
            startMs: 0,
            endMs: PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS,
          })),
        },
        'now',
      ),
    ).toBeNull()
  })
})
