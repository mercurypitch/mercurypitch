// Real recorder worker tests preserve transfer ownership, evidence deltas, and durable batch contents.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGuitarRecordingAnalysis, encodeGuitarPcm16, } from '@/lib/guitar/recording-analysis'
import type { GuitarRecordingWorkerCommand, GuitarRecordingWorkerMessage, } from '@/lib/guitar/recording-types'
import { GUITAR_RECORDING_CHUNK_FRAMES, GUITAR_RECORDING_PCM_FRAMES, } from '@/lib/guitar/recording-types'

async function harness() {
  vi.resetModules()
  const messages: GuitarRecordingWorkerMessage[] = []
  const worker = {
    onmessage: null as
      | ((event: MessageEvent<GuitarRecordingWorkerCommand>) => void)
      | null,
    postMessage(
      message: GuitarRecordingWorkerMessage,
      transfer: Transferable[],
    ) {
      messages.push(structuredClone(message, { transfer }))
    },
  }
  vi.stubGlobal('self', worker)
  await import('./guitar-recorder.worker')
  let sequence = 0
  let frames = 0
  const send = (command: GuitarRecordingWorkerCommand) =>
    worker.onmessage!({
      data: command,
    } as MessageEvent<GuitarRecordingWorkerCommand>)
  send({ type: 'init', recordingId: 'take', sampleRate: 48000 })
  return {
    messages,
    send,
    append(samples: Float32Array) {
      const count = samples.length
      const buffer = samples.buffer as ArrayBuffer
      send(
        structuredClone(
          {
            type: 'pcm',
            sequence: sequence++,
            firstFrame: frames,
            frames: count,
            buffer,
          },
          { transfer: [buffer] },
        ),
      )
      frames += count
      return buffer
    },
    finish() {
      send({ type: 'stopped', frames, clockAnomalies: 2, reason: null })
    },
    chunks: () => messages.filter((message) => message.type === 'chunk'),
    previews: () =>
      messages
        .filter((message) => message.type === 'preview')
        .map((message) => message.preview),
  }
}

function tone(count: number, firstFrame = 0): Float32Array {
  return Float32Array.from(
    { length: count },
    (_, index) =>
      0.3 * Math.sin((2 * Math.PI * 220 * (index + firstFrame)) / 48000),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('short recorder worker deliveries', () => {
  it('publishes 2048-frame previews but checkpoints 8192 frames with every leased buffer', async () => {
    const h = await harness()
    const samples = tone(GUITAR_RECORDING_CHUNK_FRAMES)
    const expected = createGuitarRecordingAnalysis('take', 48000).process(
      samples,
      samples.length,
      0,
      0,
    )
    const transferred: ArrayBuffer[] = []
    for (let index = 0; index < 3; index++)
      transferred.push(
        h.append(
          samples.slice(
            index * GUITAR_RECORDING_PCM_FRAMES,
            (index + 1) * GUITAR_RECORDING_PCM_FRAMES,
          ),
        ),
      )
    expect(h.previews().map((preview) => preview.frames)).toEqual([
      2048, 4096, 6144,
    ])
    expect(h.chunks()).toEqual([])
    transferred.push(h.append(samples.slice(6144)))
    expect(transferred.every((buffer) => buffer.byteLength === 0)).toBe(true)
    expect(h.chunks()).toHaveLength(1)
    const checkpoint = h.chunks()[0]
    expect(checkpoint.recycled).toHaveLength(4)
    expect(checkpoint.recycled.map((buffer) => buffer.byteLength)).toEqual([
      8192, 8192, 8192, 8192,
    ])
    expect(checkpoint.chunk).toEqual(expected)
    expect(h.previews().map((preview) => preview.sequence)).toEqual([
      0, 1, 2, 3,
    ])
    expect(h.previews().at(-1)?.frames).toBe(8192)
  })

  it('flushes a short capture without invented pitch evidence or padded PCM', async () => {
    const h = await harness()
    const samples = tone(128)
    const expected = encodeGuitarPcm16(samples)
    h.append(samples)
    h.finish()
    expect(h.chunks()).toHaveLength(1)
    expect(h.chunks()[0].chunk).toMatchObject({
      frames: 128,
      pcm: expected,
      pitches: [],
      notes: [],
    })
    expect(h.chunks()[0].recycled).toHaveLength(1)
    expect(h.previews().at(-1)).toMatchObject({
      frames: 128,
      pendingNote: null,
      notes: [],
      ended: true,
    })
    expect(h.messages.at(-1)).toEqual({
      type: 'finished',
      summary: {
        frames: 128,
        notes: [],
        clockAnomalies: 2,
        interruption: null,
      },
    })
    const count = h.messages.length
    h.finish()
    expect(h.messages).toHaveLength(count)
  })

  it('emits every completed note exactly once including the final held note, with full and partial checkpoints', async () => {
    const h = await harness()
    for (let index = 0; index < 12; index++) h.append(tone(2048, index * 2048))
    h.append(tone(128, 24576))
    expect(h.previews().at(-1)?.pendingNote?.midi).toBe(57)
    h.finish()
    const final = h.messages.at(-1)
    expect(final?.type).toBe('finished')
    if (final?.type !== 'finished')
      throw new Error('Missing final worker summary')
    const notes = h.previews().flatMap((preview) => preview.notes)
    expect(notes).toEqual(final.summary.notes)
    expect(notes).toHaveLength(1)
    expect(notes[0].endFrame).toBe(24576)
    expect(new Set(notes.map((note) => note.id)).size).toBe(notes.length)
    expect(h.previews().at(-1)?.pendingNote).toBeNull()
    expect(
      h
        .chunks()
        .map(({ chunk }) => [chunk.sequence, chunk.firstFrame, chunk.frames]),
    ).toEqual([
      [0, 0, 8192],
      [1, 8192, 8192],
      [2, 16384, 8192],
      [3, 24576, 128],
    ])
    expect(h.chunks().flatMap(({ chunk }) => chunk.notes)).toEqual([])
  })

  it('saves silence without fabricating notes and rejects out-of-order batches once', async () => {
    const h = await harness()
    for (let index = 0; index < 4; index++) h.append(new Float32Array(2048))
    expect(
      h
        .previews()
        .every(
          (preview) =>
            preview.notes.length === 0 && preview.pendingNote === null,
        ),
    ).toBe(true)
    expect(
      h.chunks()[0].chunk.pitches.every((pitch) => pitch.midi === null),
    ).toBe(true)
    h.send({
      type: 'pcm',
      sequence: 9,
      firstFrame: 8192,
      frames: 2048,
      buffer: new ArrayBuffer(8192),
    })
    h.finish()
    expect(h.messages.filter((message) => message.type === 'error')).toEqual([
      {
        type: 'error',
        message: 'Recording audio is incomplete or out of order.',
      },
    ])
    expect(h.messages.some((message) => message.type === 'finished')).toBe(
      false,
    )
  })
})
