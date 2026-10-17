import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioDiagnosticChange, AudioDiagnosticEntry, } from './audio-diagnostics'
import { adoptAudioDiagnostics, audioDiagnosticEntries, audioReporter, clearAudioDiagnostics, formatAudioDiagnostic, formatAudioDiagnostics, lastAudioDiagnostic, MAX_AUDIO_ENTRIES, onAudioDiagnostic, plainAudioDiagnostic, recordAudioDiagnostic, resetAudioDiagnosticsForTests, } from './audio-diagnostics'

/** The local clock as a line starts with it: 21:31:05.120. */
const CLOCK = String.raw`\d{2}:\d{2}:\d{2}\.\d{3}`

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
      new RegExp(
        `^\\[audio\\] ${CLOCK} alley fetched url=/rooms/alley/sing\\.m4a status=0 ok=false bytes=266161$`,
        'u',
      ),
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

  it('heads the copied report with what the panel can see, then the entries oldest first', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    recordAudioDiagnostic('alley', 'started', { kind: 'sing' })
    recordAudioDiagnostic('alley', 'stopped')
    const text = formatAudioDiagnostics(
      ['App: 0.9.19 (912) · iPhone17,3'],
      ['Context: running · 48000 Hz'],
    )
    const lines = text.split('\n')
    expect(lines[0]).toBe('MercuryPitch audio diagnostics')
    expect(lines[1]).toBe('App: 0.9.19 (912) · iPhone17,3')
    expect(lines[2]).toMatch(/^when: \d{4}-\d{2}-\d{2} /u)
    expect(lines[3]).toBe(`agent: ${navigator.userAgent}`)
    expect(lines[4]).toBe('entries: 2')
    expect(lines[5]).toBe('Context: running · 48000 Hz')
    expect(lines.at(-2)).toMatch(/alley started kind=sing$/u)
    expect(lines.at(-1)).toMatch(/alley stopped$/u)
  })

  it('says the day before its first entry and wherever the day changes', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 16, 23, 59, 58))
    recordAudioDiagnostic('room', 'enter', { room: 'echo' })
    vi.setSystemTime(new Date(2026, 9, 17, 0, 0, 3))
    recordAudioDiagnostic('room', 'leave', { room: 'echo' })
    const lines = formatAudioDiagnostics().split('\n')
    vi.useRealTimers()
    expect(lines.slice(-4)).toEqual([
      '-- 2026-10-16 --',
      '23:59:58.000 room enter room=echo',
      '-- 2026-10-17 --',
      '00:00:03.000 room leave room=echo',
    ])
  })

  it('marks an entry made while the app was behind', () => {
    const entry: AudioDiagnosticEntry = {
      at: 0,
      wall: new Date(2026, 9, 17, 21, 31, 5, 120).toISOString(),
      source: 'app',
      event: 'background',
      detail: {},
      failed: false,
      visibility: 'hidden',
    }
    expect(formatAudioDiagnostic(entry)).toBe(
      '21:31:05.120 app background [hidden]',
    )
  })

  it('starts clean when cleared, and tells its subscribers so', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const heard: AudioDiagnosticChange['kind'][] = []
    const off = onAudioDiagnostic((change) => heard.push(change.kind))
    recordAudioDiagnostic('alley', 'started')
    clearAudioDiagnostics()
    expect(audioDiagnosticEntries()).toEqual([])
    expect(heard).toEqual(['entry', 'cleared'])
    off()
  })

  it('puts the last launch’s entries in front of this one’s, and keeps the newest', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    recordAudioDiagnostic('app', 'launch')
    const older = Array.from({ length: MAX_AUDIO_ENTRIES }, (_, i) =>
      plainAudioDiagnostic({
        at: i,
        wall: new Date(2026, 9, 16, 12, 0, 0, i).toISOString(),
        source: 'room',
        event: `step-${String(i)}`,
        detail: {},
        failed: false,
        visibility: 'visible',
      }),
    )
    const heard: AudioDiagnosticChange['kind'][] = []
    const off = onAudioDiagnostic((change) => heard.push(change.kind))
    adoptAudioDiagnostics(older)
    const kept = audioDiagnosticEntries()
    expect(kept).toHaveLength(MAX_AUDIO_ENTRIES)
    expect(kept[0]?.event).toBe('step-1')
    expect(kept.at(-1)?.event).toBe('launch')
    expect(heard).toEqual(['adopted'])
    off()
  })

  it('makes an entry plain enough to keep: an error becomes its words', () => {
    const plain = plainAudioDiagnostic({
      at: 3,
      wall: '2026-10-17T19:31:05.120Z',
      source: 'census',
      event: 'mic-failed',
      detail: {
        error: new DOMException('Permission denied', 'NotAllowedError'),
        n: 2,
        live: true,
        ports: ['Speaker'],
      },
      failed: true,
      visibility: 'visible',
    })
    expect(plain.detail).toEqual({
      error: 'NotAllowedError: Permission denied',
      n: 2,
      live: true,
      ports: 'Speaker',
    })
    expect(JSON.parse(JSON.stringify(plain))).toEqual(plain)
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
