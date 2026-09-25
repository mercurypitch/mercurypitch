import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioDiagnosticEntries, audioReporter, formatAudioDiagnostics, lastAudioDiagnostic, MAX_AUDIO_ENTRIES, onAudioDiagnostic, recordAudioDiagnostic, resetAudioDiagnosticsForTests, } from './audio-diagnostics'

describe('the audio recorder', () => {
  beforeEach(() => {
    resetAudioDiagnosticsForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes every step to the console, and only a failure as a warning', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    recordAudioDiagnostic('alley', 'fetched', {
      url: '/rooms/alley/sing.m4a',
      status: 0,
      ok: false,
      bytes: 266_161,
    })
    recordAudioDiagnostic(
      'alley',
      'decode-failed',
      {
        error: new DOMException('Unable to decode audio data', 'EncodingError'),
      },
      true,
    )
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatch(
      /^\[audio\] +0\.00s alley fetched url=\/rooms\/alley\/sing\.m4a status=0 ok=false bytes=266161 \[visible\]$/,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain(
      'alley decode-failed error=EncodingError: Unable to decode audio data',
    )
    expect(audioDiagnosticEntries().map((e) => [e.event, e.failed])).toEqual([
      ['fetched', false],
      ['decode-failed', true],
    ])
  })

  it(`keeps the newest ${MAX_AUDIO_ENTRIES} and lets the oldest go`, () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    for (let i = 0; i < MAX_AUDIO_ENTRIES + 50; i += 1) {
      recordAudioDiagnostic('alley', `step-${i}`)
    }
    const kept = audioDiagnosticEntries()
    expect(kept).toHaveLength(MAX_AUDIO_ENTRIES)
    expect(kept[0]?.event).toBe('step-50')
    expect(formatAudioDiagnostics()).toContain(
      `entries: ${MAX_AUDIO_ENTRIES} (oldest dropped)`,
    )
  })

  it('finds the last entry of a kind, and binds a reporter to its source', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const report = audioReporter('tone')
    report('context', { state: 'running' })
    report('started', { state: 'running' })
    report('context', { state: 'suspended' })
    const last = lastAudioDiagnostic((e) => e.event === 'context')
    expect(last?.source).toBe('tone')
    expect(last?.detail).toEqual({ state: 'suspended' })
    expect(lastAudioDiagnostic((e) => e.event === 'fetched')).toBeNull()
  })

  it('heads the copied report with the device and what the panel can see', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    recordAudioDiagnostic('alley', 'started', { kind: 'sing' })
    const text = formatAudioDiagnostics(['context: running 48000 Hz'])
    const lines = text.split('\n')
    expect(lines[0]).toBe('MercuryPitch audio diagnostics')
    expect(lines).toContain(`agent: ${navigator.userAgent}`)
    expect(lines).toContain('entries: 1')
    expect(lines).toContain('context: running 48000 Hz')
    expect(lines.at(-1)).toMatch(/alley started kind=sing/)
  })

  it('tells every subscriber, even after one of them throws', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const heard: string[] = []
    const offBad = onAudioDiagnostic(() => {
      throw new Error('a panel that broke')
    })
    const offGood = onAudioDiagnostic(() => heard.push('good'))
    recordAudioDiagnostic('alley', 'stopped')
    expect(heard).toEqual(['good'])
    offBad()
    offGood()
    recordAudioDiagnostic('alley', 'stopped')
    expect(heard).toEqual(['good'])
  })
})
