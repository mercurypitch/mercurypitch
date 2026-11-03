// ============================================================
// The audio report in the console, as a song starts on AirPlay alone
// ============================================================
//
// Leaving the Karaoke stage for Settings stops the song, so the report the
// Developer screen copies could not be sent while the sound was lost on
// AirPlay (owner, 3 Nov 2026). The same report goes into the console once a
// launch instead, in parts a console line keeps whole.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { noteSongStart, resetAirPlaySuspicionForTests, } from '@/stores/airplay-suspicion'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { CONSOLE_PART_MAX, reportOnAirPlay, reportParts, writeReportToConsole, } from './audio-report'

/** The portable console keeps this much of a line (portable-console.ts). */
const CONSOLE_LINE_KEEPS = 2000

let info: MockInstance<(...data: unknown[]) => void>

beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests('speaker', 'Speaker', 48000)
})

afterEach(() => {
  info.mockRestore()
  resetAirPlaySuspicionForTests()
  setAudioRouteForTests(null)
})

/** A report as long as a busy record makes it. */
const longReport = (): string =>
  [
    'MercuryPitch audio diagnostics',
    'App: 0.8.53 (1400) · iPhone12,1 · iOS 18.7',
    ...Array.from(
      { length: 400 },
      (_, n) =>
        `19:02:${String(n % 60).padStart(2, '0')}.120 karaoke play by=button clockWas=running position=${String(n)}`,
    ),
  ].join('\n')

describe('reportParts', () => {
  it('keeps every line, whole and in order, in parts a console line keeps', () => {
    const text = longReport()

    const parts = reportParts(text)

    expect(parts.length).toBeGreaterThan(1)
    expect(parts.join('\n')).toBe(text)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(CONSOLE_PART_MAX)
    }
  })

  it('cuts a single line longer than a part', () => {
    const line = 'x'.repeat(CONSOLE_PART_MAX * 2 + 10)

    const parts = reportParts(line)

    expect(parts.map((part) => part.length)).toEqual([
      CONSOLE_PART_MAX,
      CONSOLE_PART_MAX,
      10,
    ])
  })
})

describe('writeReportToConsole', () => {
  it('writes numbered info lines, each one the console keeps whole', () => {
    writeReportToConsole(longReport(), 'a song started on AirPlay')

    const lines = info.mock.calls.map((call) => String(call[0]))
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[0]).toMatch(
      new RegExp(
        `^\\[audio report 1/${String(lines.length)}\\] a song started on AirPlay\\nMercuryPitch audio diagnostics`,
        'u',
      ),
    )
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(CONSOLE_LINE_KEEPS)
    }
  })
})

describe('reportOnAirPlay', () => {
  it('writes the report as a song starts on AirPlay alone, once a launch', async () => {
    const build = vi.fn(async () => 'MercuryPitch audio diagnostics\nApp: test')
    const stop = reportOnAirPlay(build)
    setAudioRouteForTests('airplay', 'LG webOS TV', 44100)

    noteSongStart()
    noteSongStart()
    await vi.waitFor(() => {
      expect(info).toHaveBeenCalled()
    })

    expect(build).toHaveBeenCalledTimes(1)
    expect(info.mock.calls.map((call) => String(call[0]))).toEqual([
      '[audio report 1/1] a song started on AirPlay\nMercuryPitch audio diagnostics\nApp: test',
    ])
    stop()
  })

  it('writes nothing for a song on the phone', async () => {
    const build = vi.fn(async () => 'report')
    const stop = reportOnAirPlay(build)

    noteSongStart()
    await Promise.resolve()

    expect(build).not.toHaveBeenCalled()
    stop()
  })
})
