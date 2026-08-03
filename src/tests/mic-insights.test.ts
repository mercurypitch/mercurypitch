// ============================================================
// Mic Insights tests — detector-aligned input warning policy
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyMicSignal, useMicInsights, } from '@/features/mic-feedback/useMicInsights'

afterEach(() => vi.unstubAllGlobals())

describe('classifyMicSignal', () => {
  it('does not warn before playback starts', () => {
    expect(
      classifyMicSignal({
        isPlaying: false,
        isDetecting: false,
        level: 0.2,
        minAmplitude: 0.01,
      }),
    ).toBe('none')
  })

  it('does not call strong unpitched input too weak', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.2,
        minAmplitude: 0.01,
      }),
    ).toBe('none')
  })

  it('preserves existing callers when their detector gate is unavailable', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.2,
      }),
    ).toBe('too-quiet')
  })

  it('reports only input below the detector gate as too quiet', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.015,
        minAmplitude: 0.02,
      }),
    ).toBe('too-quiet')
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0.02,
        minAmplitude: 0.02,
      }),
    ).toBe('none')
  })

  it('distinguishes silence and clears as soon as pitch is detected', () => {
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: false,
        level: 0,
      }),
    ).toBe('no-input')
    expect(
      classifyMicSignal({
        isPlaying: true,
        isDetecting: true,
        level: 0,
      }),
    ).toBe('none')
  })

  it('debounces a weak signal and clears it on the first recovered frame', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      callbacks.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks.delete(id)
    })

    const runFrame = () => {
      const next = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      expect(next).toBeDefined()
      if (!next) return
      callbacks.delete(next[0])
      next[1](performance.now())
    }

    let level = 0.015
    let detecting = false
    let dispose = () => {}
    const insights = createRoot((rootDispose) => {
      dispose = rootDispose
      return useMicInsights({
        micActive: () => true,
        isPlaying: () => true,
        getLevel: () => level,
        getMinAmplitude: () => 0.02,
        isDetecting: () => detecting,
      })
    })

    for (let frame = 0; frame < 60; frame += 1) runFrame()
    expect(insights.insight()).toBe('too-quiet')

    detecting = true
    runFrame()
    expect(insights.insight()).toBe('none')

    detecting = false
    level = 0.2
    runFrame()
    expect(insights.insight()).toBe('none')

    dispose()
    expect(callbacks.size).toBe(0)
  })
})
