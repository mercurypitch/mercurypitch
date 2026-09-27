// ============================================================
// The Microphone screen's level check
// ============================================================
//
// S6 7a. It opens the shared microphone, reads the level every frame and
// holds the loudest peak of the last moment on show, and it reads what the
// phone says about the input. A refused microphone is named as refused, so
// the screen can send the singer to the one place that changes it (7c); any
// other failure is named as unavailable. Stopping hands the microphone back.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LevelCheckDeps } from './level-check'
import { createLevelCheck, FLOOR_DB, inputLine, knownInput, PEAK_HOLD_MS, peakDb, peakLabel, peakText, resetKnownInput, } from './level-check'

interface Rig {
  deps: LevelCheckDeps
  /** Run one animation frame with this amplitude in every sample. */
  frame: (amplitude: number) => void
  clock: { now: number }
  acquire: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
  closed: () => boolean
}

function rig(options: { failWith?: string; label?: string } = {}): Rig {
  let pending: (() => void) | null = null
  let amplitude = 0
  let closed = false
  const clock = { now: 0 }
  const track = {
    label: options.label ?? 'iPhone Microphone',
    getSettings: () => ({ sampleRate: 48_000, channelCount: 1 }),
  }
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream
  const acquire = vi.fn(async () => {
    if (options.failWith !== undefined) {
      throw Object.assign(new Error('refused'), { kind: options.failWith })
    }
    return stream
  })
  const release = vi.fn()
  const deps: LevelCheckDeps = {
    acquire,
    release,
    createContext: () => ({
      sampleRate: 44_100,
      resume: async () => undefined,
      close: async () => {
        closed = true
      },
      createMediaStreamSource: () => ({
        connect: () => undefined,
        disconnect: () => undefined,
      }),
      createAnalyser: () => ({
        fftSize: 2048,
        getFloatTimeDomainData: (buffer: Float32Array) => {
          buffer.fill(amplitude)
        },
      }),
    }),
    frame: (callback) => {
      pending = callback
      return 1
    },
    cancelFrame: () => {
      pending = null
    },
    now: () => clock.now,
  }
  return {
    deps,
    clock,
    acquire,
    release,
    closed: () => closed,
    frame: (next) => {
      amplitude = next
      const run = pending
      pending = null
      run?.()
    },
  }
}

beforeEach(() => {
  resetKnownInput()
})

describe('the level check', () => {
  it('opens the shared microphone and names the input', async () => {
    const r = rig()
    const check = createLevelCheck(r.deps)

    await check.start()

    expect(r.acquire).toHaveBeenCalledTimes(1)
    expect(check.state()).toBe('live')
    expect(check.input()).toEqual({
      label: 'iPhone Microphone',
      sampleRate: 48_000,
      channels: 1,
    })
    expect(knownInput()).toEqual(check.input())
  })

  it('reads the peak of each frame, in dB below full scale', async () => {
    const r = rig()
    const check = createLevelCheck(r.deps)
    await check.start()

    r.frame(0.355)

    expect(check.peak()).toBe(-9)
    expect(check.level()).toBeGreaterThan(0.8)
  })

  it('holds a peak for a moment before a quieter one replaces it', async () => {
    const r = rig()
    const check = createLevelCheck(r.deps)
    await check.start()
    r.frame(0.355)

    r.clock.now = PEAK_HOLD_MS - 100
    r.frame(0.01)
    const held = check.peak()
    r.clock.now = PEAK_HOLD_MS + 200
    r.frame(0.01)

    expect(held).toBe(-9)
    expect(check.peak()).toBe(-40)
  })

  it('names a refused microphone as refused, for the way to Settings (7c)', async () => {
    const r = rig({ failWith: 'permission-denied' })
    const check = createLevelCheck(r.deps)

    await check.start()

    expect(check.state()).toBe('denied')
    expect(knownInput()).toBe('denied')
    expect(r.closed()).toBe(true)
  })

  it('names any other failure as unavailable', async () => {
    const r = rig({ failWith: 'device-busy' })
    const check = createLevelCheck(r.deps)

    await check.start()

    expect(check.state()).toBe('unavailable')
  })

  it('hands the microphone back when it stops', async () => {
    const r = rig()
    const check = createLevelCheck(r.deps)
    await check.start()

    check.stop()
    r.frame(0.5)

    expect(r.release).toHaveBeenCalledWith('settings-level-check')
    expect(r.closed()).toBe(true)
    expect(check.state()).toBe('idle')
    expect(check.peak()).toBe(FLOOR_DB)
  })

  it('hands back a microphone that opened after it was stopped', async () => {
    const r = rig()
    const check = createLevelCheck(r.deps)

    const opening = check.start()
    check.stop()
    await opening

    expect(r.release).toHaveBeenCalledWith('settings-level-check')
    expect(check.state()).toBe('idle')
  })
})

describe('the words', () => {
  it('writes the peak as the mock does, with a true minus sign', () => {
    expect(peakText(-9)).toBe('Peak −9 dB')
    expect(peakText(0)).toBe('Peak 0 dB')
    expect(peakText(FLOOR_DB)).toBe('Peak below −60 dB')
    expect(peakLabel(-9)).toBe('Input level, peaking at minus 9 decibels')
  })

  it('finds the peak of a frame', () => {
    expect(peakDb(new Float32Array([0, -0.5, 0.25]))).toBeCloseTo(-6.02, 1)
    expect(peakDb(new Float32Array(8))).toBe(FLOOR_DB)
  })

  it('says the input format in the order 7a draws it', () => {
    expect(
      inputLine({
        label: 'iPhone Microphone',
        sampleRate: 48_000,
        channels: 1,
      }),
    ).toBe('48 kHz · mono · access allowed')
    expect(inputLine({ label: 'USB', sampleRate: 44_100, channels: 2 })).toBe(
      '44.1 kHz · stereo · access allowed',
    )
    expect(
      inputLine({ label: 'Microphone', sampleRate: null, channels: null }),
    ).toBe('access allowed')
  })
})
