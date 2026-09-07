// Recording tests use actual PCM and frame-clock evidence, not mocked detector answers.
import { describe, expect, it } from 'vitest'
import { createGuitarMelodySegmenter, createGuitarRecordingAnalysis, encodeGuitarPcm16, guitarWavHeader, } from './recording-analysis'
import { createGuitarPcmCapture } from './recording-pcm-capture'
import type { GuitarCaptureMessage } from './recording-types'

describe('guitar PCM capture', () => {
  it('copies arbitrary render blocks in sequence without touching their levels', () => {
    const messages: GuitarCaptureMessage[] = []
    const capture = createGuitarPcmCapture((message) => messages.push(message))
    for (let n = 0; n < 3; n++)
      capture.command({ type: 'buffer', buffer: new ArrayBuffer(10 * 4) })
    capture.command({ type: 'start', maxFrames: 100 })
    capture.process(Float32Array.from([0.1, 0.2, -0.5]), 700)
    capture.process(Float32Array.from([0.3, 0.4, 0.5, -0.6]), 703)
    capture.command({ type: 'stop', reason: null })
    expect(messages[0]).toEqual({ type: 'started', audioStartFrame: 700 })
    const chunk = messages.find((message) => message.type === 'pcm')!
    expect(chunk.firstFrame).toBe(0)
    expect(chunk.frames).toBe(7)
    expect([...new Float32Array(chunk.buffer).slice(0, 7)]).toEqual([
      ...Float32Array.from([0.1, 0.2, -0.5, 0.3, 0.4, 0.5, -0.6]),
    ])
    expect(messages.at(-1)).toEqual({
      type: 'stopped',
      frames: 7,
      clockAnomalies: 0,
      reason: null,
    })
  })
  it('stops on backpressure without losing or overwriting its captured prefix', () => {
    const messages: GuitarCaptureMessage[] = []
    const capture = createGuitarPcmCapture((message) => messages.push(message))
    capture.command({ type: 'buffer', buffer: new ArrayBuffer(4 * 4) })
    capture.command({ type: 'start', maxFrames: 100 })
    capture.process(Float32Array.from([1, 2, 3, 4, 5, 6]), 20)
    expect(messages.at(-1)).toMatchObject({
      type: 'stopped',
      frames: 4,
      reason: expect.stringContaining('fell behind'),
    })
    const chunk = messages.find((message) => message.type === 'pcm')!
    expect([...new Float32Array(chunk.buffer)]).toEqual([1, 2, 3, 4])
  })
  it('counts audio-clock anomalies without introducing holes into the WAV', () => {
    const messages: GuitarCaptureMessage[] = []
    const capture = createGuitarPcmCapture((message) => messages.push(message))
    capture.command({ type: 'buffer', buffer: new ArrayBuffer(64) })
    capture.command({ type: 'start', maxFrames: 100 })
    capture.process(new Float32Array(3).fill(0.2), 100)
    capture.process(new Float32Array(5).fill(0.4), 100)
    capture.command({ type: 'stop', reason: null })
    expect(messages.at(-1)).toMatchObject({ frames: 8, clockAnomalies: 1 })
  })
})

describe('recorded melody', () => {
  it('previews an open recognized note without committing it or losing its final boundary', () => {
    const segmenter = createGuitarMelodySegmenter(1000)
    segmenter.attack(0)
    for (let frame = 20; frame <= 260; frame += 20)
      segmenter.push({ frame, midi: 59, clarity: 0.9 })
    expect(segmenter.notes()).toEqual([])
    expect(segmenter.preview()).toMatchObject({
      id: 'note-0',
      midi: 59,
      startFrame: 0,
      endFrame: 260,
    })
    expect(segmenter.finish(300)).toEqual([
      expect.objectContaining({
        id: 'note-0',
        midi: 59,
        startFrame: 0,
        endFrame: 300,
      }),
    ])
    expect(segmenter.preview()).toBeNull()
  })
  it('retains repeated picks, legato and the final sustain independently of a song', () => {
    const segmenter = createGuitarMelodySegmenter(1000)
    segmenter.attack(0)
    for (let frame = 20; frame < 300; frame += 20)
      segmenter.push({ frame, midi: 64, clarity: 0.9 })
    segmenter.attack(300)
    for (let frame = 320; frame < 600; frame += 20)
      segmenter.push({ frame, midi: 64, clarity: 0.9 })
    for (let frame = 600; frame < 900; frame += 20)
      segmenter.push({ frame, midi: 67, clarity: 0.85 })
    const notes = segmenter.finish(900)
    expect(
      notes.map((note) => [
        note.midi,
        note.startFrame,
        note.endFrame,
        note.onset,
      ]),
    ).toEqual([
      [64, 0, 300, 'attack'],
      [64, 300, 600, 'attack'],
      [67, 600, 900, 'pitch-change'],
    ])
  })
  it('does not invent notes from low-confidence silence', () => {
    const analysis = createGuitarRecordingAnalysis('quiet', 48000)
    analysis.process(new Float32Array(8192), 8192, 0, 0)
    expect(analysis.finish()).toEqual({ frames: 8192, notes: [] })
  })
  it('extracts E2 and A3 from actual PCM with durations and no octave folding', () => {
    const rate = 48000
    const analysis = createGuitarRecordingAnalysis('signal', rate)
    const samples = new Float32Array(rate * 2)
    for (let index = 0; index < samples.length; index++) {
      const t = index / rate
      const frequency = t < 0.7 ? 82.4069 : t > 1 && t < 1.7 ? 220 : 0
      samples[index] = frequency
        ? 0.3 * Math.sin(2 * Math.PI * frequency * t)
        : 0
    }
    let sequence = 0
    for (let first = 0; first < samples.length; first += 8192) {
      const block = samples.slice(first, first + 8192)
      analysis.process(block, block.length, sequence++, first)
    }
    const result = analysis.finish()
    expect(result.frames).toBe(samples.length)
    expect(result.notes.map((note) => note.midi)).toEqual([40, 57])
    expect(result.notes[0].startFrame / rate).toBeLessThan(0.04)
    expect(result.notes[0].endFrame / rate).toBeGreaterThan(0.65)
    expect(result.notes[1].startFrame / rate).toBeGreaterThan(0.95)
    expect(result.notes[1].endFrame / rate).toBeLessThan(1.8)
  })
  it('writes interoperable mono PCM16 headers and clipped finite samples', () => {
    const bytes = encodeGuitarPcm16(
      Float32Array.from([-2, -0.5, 0, 0.5, 2, NaN]),
    )
    const view = new DataView(bytes)
    expect(
      Array.from({ length: 6 }, (_, index) => view.getInt16(index * 2, true)),
    ).toEqual([-32768, -16384, 0, 16384, 32767, 0])
    const header = new DataView(guitarWavHeader(6, 44100))
    expect(header.getUint32(4, true)).toBe(48)
    expect(header.getUint16(22, true)).toBe(1)
    expect(header.getUint32(24, true)).toBe(44100)
    expect(header.getUint32(28, true)).toBe(88200)
    expect(header.getUint32(40, true)).toBe(12)
  })
})
