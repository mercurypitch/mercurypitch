// Voice diagnostics tests — local evidence stays bounded and excludes captured notes and device identity.
import type { CapturedPitchFrame, F0Stream } from '@irchiinnuss/pitch-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunnerSessionState } from '../runner/session-contracts'
import { createRunnerLifecycleDiagnostics, createVoiceDiagnostics, } from './voice-diagnostics'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup() {
  let count = 0
  let captured: CapturedPitchFrame | null = null
  const context = { state: 'running', currentTime: 10 } as AudioContext
  const track = {
    readyState: 'live',
    muted: false,
    id: 'private-device',
    label: 'private-name',
  } as MediaStreamTrack
  const stream = {
    frameCount: () => count,
    latestCaptured: () => captured,
  } as F0Stream
  const diagnostics = createVoiceDiagnostics(() => ({
    context,
    tracks: [track],
    stream,
  }))
  const tick = (frames = 94, pitch = 440, delay = 0.03) => {
    Object.assign(context, { currentTime: context.currentTime + 2 })
    count += frames
    if (frames)
      captured = {
        sequence: count,
        capturedAudioSeconds: context.currentTime - delay,
        frame: { t: 0, f0: pitch, conf: 0.99, rms: pitch ? 0.02 : 0 },
      }
    vi.advanceTimersByTime(2000)
  }
  return { diagnostics, tick, context }
}

describe('portable microphone evidence', () => {
  it('distinguishes a running clock with no frames from fresh silence and actual captured pitch', () => {
    const { diagnostics, tick } = setup()
    diagnostics.report('capturing')
    tick(0)
    tick(94, 0)
    tick(94, 440, 0.35)
    const rows = vi.mocked(console.info).mock.calls.map((call) => call[1])
    expect(rows[1]).toMatchObject({
      clockAdvancing: true,
      framesSinceLast: 0,
      signal: 'none',
      captureAgeMs: null,
    })
    expect(rows[2]).toMatchObject({
      clockAdvancing: true,
      framesSinceLast: 94,
      signal: 'silence',
      captureAgeMs: 30,
    })
    expect(rows[3]).toMatchObject({ signal: 'pitched', captureAgeMs: 350 })
    const report = JSON.stringify(rows)
    for (const privateValue of [
      'private-device',
      'private-name',
      '440',
      '0.99',
      '0.02',
      'samples',
      'midi',
      'f0',
    ])
      expect(report).not.toContain(privateValue)
    diagnostics.report('stopped', 'requested')
  })

  it('stays quiet for unchanged healthy input or silence and always clears its timer on stop', () => {
    const { diagnostics, tick } = setup()
    diagnostics.report('capturing')
    for (let n = 0; n < 20; n++) tick(94, 0)
    expect(console.info).toHaveBeenCalledTimes(2)
    diagnostics.report('stopped', 'track-mute')
    expect(vi.mocked(console.info).mock.calls.at(-1)?.[1]).toMatchObject({
      stage: 'stopped',
      reason: 'track-mute',
    })
    expect(vi.getTimerCount()).toBe(0)
    tick()
    diagnostics.report('stopped', 'requested')
    expect(console.info).toHaveBeenCalledTimes(3)
  })

  it('caps health reports even when the signal alternates and still records the stop reason', () => {
    const { diagnostics, tick } = setup()
    diagnostics.report('capturing')
    for (let n = 0; n < 40; n++) tick(94, n % 2 ? 440 : 0)
    expect(console.info).toHaveBeenCalledTimes(9)
    expect(vi.getTimerCount()).toBe(0)
    diagnostics.report('stopped', 'manager-released')
    expect(console.info).toHaveBeenCalledTimes(10)
  })

  it('records a stalled audio clock separately from missing capture', () => {
    const { diagnostics } = setup()
    diagnostics.report('capturing')
    vi.advanceTimersByTime(2000)
    expect(vi.mocked(console.info).mock.calls.at(-1)?.[1]).toMatchObject({
      clockAdvancing: false,
      framesSinceLast: 0,
    })
    diagnostics.report('stopped', 'audio-interrupted')
  })

  it('bounds runner transitions and never serializes game state, selected notes or error text', () => {
    const report = createRunnerLifecycleDiagnostics()
    const state = {
      phase: 'readiness',
      microphone: 'ready',
      pauseReason: null,
      readiness: { targetMidi: 57 },
      game: { privateScore: 9876 },
      error: {
        code: 'microphone-unavailable',
        message: 'private browser device name',
      },
    } as unknown as RunnerSessionState
    report(state)
    report(state)
    expect(console.info).toHaveBeenCalledOnce()
    for (let n = 0; n < 100; n++)
      report({ ...state, phase: n % 2 ? 'readiness' : 'paused' })
    expect(console.info).toHaveBeenCalledTimes(24)
    const log = JSON.stringify(vi.mocked(console.info).mock.calls)
    for (const privateValue of [
      'targetMidi',
      'privateScore',
      '9876',
      'private browser',
      '57',
    ])
      expect(log).not.toContain(privateValue)
  })
})
