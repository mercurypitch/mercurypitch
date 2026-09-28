// The Developer screen's Karaoke audio section, read the way a tester reads
// it: two switches that take the room down the no-streaming path and past
// its guard, and rows that say what this phone answers and which way the
// last song was held. jsdom has no AudioDecoder, as a WKWebView before iOS
// 26 has none; a case that wants one stubs it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSongPathLog, resetSongPathForTests, } from '@/features/stem-mixer/stem-load-path'
import { DECODE_PAST_GUARD_KEY, decodePastGuard, FORCE_NO_STREAM_KEY, noStreamForced, reloadStreamSwitchesForTests, } from '@/features/stem-mixer/stream-switches'
import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { KaraokeAudioPanel } from './KaraokeAudioPanel'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'

let view: RenderedShell | null = null

function open(): void {
  view = renderShell(() => <KaraokeAudioPanel />)
}

function el<T extends Element>(selector: string): T {
  const found = view?.container.querySelector<T>(selector)
  if (found === null || found === undefined) throw new Error(selector)
  return found
}

const row = (id: string): string =>
  el(`[data-karaoke-row="${id}"] dd`).textContent ?? ''
const toggle = (id: string) => el<HTMLButtonElement>(`[data-testid="${id}"]`)

/** An AudioDecoder whose isConfigSupported says yes to MP3 alone. */
function stubDecoder(): void {
  vi.stubGlobal(
    'AudioDecoder',
    Object.assign(vi.fn(), {
      isConfigSupported: (config: AudioDecoderConfig) =>
        Promise.resolve({ supported: config.codec === 'mp3', config }),
    }),
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  localStorage.clear()
  reloadStreamSwitchesForTests()
  resetAudioDiagnosticsForTests()
  resetSongPathForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  reloadStreamSwitchesForTests()
  document.body.innerHTML = ''
})

describe('the switches', () => {
  it('are both off, and named for what they do', () => {
    open()
    const force = toggle('dev-karaoke-force-no-stream')
    const past = toggle('dev-karaoke-decode-past-guard')
    expect(force.getAttribute('aria-label')).toBe('Force the no-streaming path')
    expect(past.getAttribute('aria-label')).toBe(
      'Allow full decode past the guard',
    )
    expect(force.getAttribute('aria-checked')).toBe('false')
    expect(past.getAttribute('aria-checked')).toBe('false')
    // The second one says plainly what it is.
    expect(
      el('[data-settings-row="karaoke-decode-past-guard"]').textContent,
    ).toContain('A crash test.')
  })

  it('take the room down the no-streaming path, and keep it there', () => {
    open()
    toggle('dev-karaoke-force-no-stream').click()

    expect(
      toggle('dev-karaoke-force-no-stream').getAttribute('aria-checked'),
    ).toBe('true')
    expect(noStreamForced()).toBe(true)
    expect(localStorage.getItem(FORCE_NO_STREAM_KEY)).toBe('1')
  })

  it('say where the no-streaming path draws the line: 12 MB a stem', () => {
    open()
    expect(
      el('[data-settings-row="karaoke-force-no-stream"]').textContent,
    ).toContain(
      'A song with a stem over 12 MB is refused; a smaller stem is decoded whole.',
    )
  })

  it('let a song past the guard only when the crash test is turned on', () => {
    open()
    expect(decodePastGuard()).toBe(false)
    toggle('dev-karaoke-decode-past-guard').click()

    expect(decodePastGuard()).toBe(true)
    expect(localStorage.getItem(DECODE_PAST_GUARD_KEY)).toBe('1')
  })
})

describe('the rows', () => {
  it('say a phone without AudioDecoder has nothing to stream with', async () => {
    open()
    expect(row('decoder')).toBe('absent: every song takes the fallback')
    await vi.waitFor(() => {
      expect(row('mp3')).toBe('no AudioDecoder to ask')
    })
    expect(row('aac')).toBe('no AudioDecoder to ask')
    expect(row('last-song')).toBe('none yet: open a song in the Karaoke room')
    expect(row('last-codec')).toBe('none yet')
  })

  it('say what the phone answers for each codec the room streams, and write it down', async () => {
    stubDecoder()
    open()
    expect(row('decoder')).toBe('present: the room streams')
    await vi.waitFor(() => {
      expect(row('mp3')).toBe('supported')
    })
    expect(row('aac')).toBe('not supported')

    const asked = audioDiagnosticEntries().find(
      (entry) => entry.event === 'codec-support',
    )
    expect(asked?.detail).toEqual({
      audioDecoder: 'present',
      mp3: 'supported',
      aac: 'not supported',
    })
  })

  it('say the room is told there is no AudioDecoder while the switch is on', () => {
    stubDecoder()
    open()
    toggle('dev-karaoke-force-no-stream').click()
    expect(row('decoder')).toBe('present, but the room is told it is absent')
  })

  it('say which way the last song was held, and ask about its own codec', async () => {
    stubDecoder()
    const log = createSongPathLog({ streams: false })
    log.decided({
      name: 'vocal.mp3',
      path: 'refused',
      bytes: 9 * 1024 * 1024,
      wholeDecodeBytes: 90 * 1024 * 1024,
      codec: 'mp3',
      sampleRate: 44_100,
      channelCount: 2,
    })
    log.finished()
    open()

    expect(row('last-song')).toBe(
      'refused by the guard · 9.0 MB in 1 stem · a whole decode would hold about 90.0 MB · mp3',
    )
    await vi.waitFor(() => {
      expect(row('last-codec')).toBe('mp3 · 44100 Hz · 2 ch · supported')
    })
  })

  it('follow a song the room opens while the section is on screen', () => {
    open()
    expect(row('last-song')).toBe('none yet: open a song in the Karaoke room')

    const log = createSongPathLog({ streams: true })
    log.decided({
      name: 'vocal.mp3',
      path: 'stream',
      bytes: 1024 * 1024,
      wholeDecodeBytes: 10 * 1024 * 1024,
    })
    expect(row('last-song')).toBe(
      'streamed · 1.0 MB in 1 stem · a whole decode would hold about 10.0 MB · loading',
    )
    log.finished()
  })
})
