// ============================================================
// voice-diagnostics
// ============================================================
// The recorder exists to answer one question on a device that cannot open an
// inspector: was the ear dead, or alive and hearing nothing? These pin the
// properties that make the answer trustworthy — off by default, remembered
// across a page load, bounded, and never carrying the singer's words.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceVoiceDiagnostics, clearVoiceDiagnostics, formatVoiceDiagnostics, initVoiceDiagnostics, onVoiceDiagnostic, probeMicrophone, recordVoiceDiagnostic, resetVoiceDiagnosticsForTests, setVoiceDiagnosticsEnabled, voiceDiagnosticEntries, voiceDiagnosticsEnabled, } from './voice-diagnostics'

let info: ReturnType<typeof spyOnInfo>

function spyOnInfo() {
  return vi.spyOn(console, 'info').mockImplementation(() => undefined)
}

/**
 * The entry for one event.
 *
 * Turning the recording on writes a `document-open` line of its own, so
 * `entries[0]` is not the first thing a test recorded — and indexes would
 * break again the next time the recorder learns to note something.
 */
function find(event: string) {
  const entry = voiceDiagnosticEntries().find((one) => one.event === event)
  if (entry === undefined) throw new Error(`no ${event} entry was recorded`)
  return entry
}

beforeEach(() => {
  localStorage.clear()
  resetVoiceDiagnosticsForTests()
  info = spyOnInfo()
})

afterEach(() => {
  info.mockRestore()
  resetVoiceDiagnosticsForTests()
  localStorage.clear()
})

describe('turning it on', () => {
  it('stays off, and records nothing, when nobody asked', () => {
    initVoiceDiagnostics('')

    recordVoiceDiagnostic('start', 1)

    expect(voiceDiagnosticsEnabled()).toBe(false)
    expect(voiceDiagnosticEntries()).toHaveLength(0)
    // Silent too: this sits on the recognizer's hot path, and a console line
    // per interim result would be its own problem.
    expect(info).not.toHaveBeenCalled()
  })

  it('turns on for ?voicelog=1', () => {
    initVoiceDiagnostics('?voicelog=1')

    expect(voiceDiagnosticsEnabled()).toBe(true)
  })

  it('remembers, because Karaoke Night is a separate page load', () => {
    initVoiceDiagnostics('?voicelog=1')
    // Walking into another document and back is two full loads, and the URL
    // does not survive them. A recording that stopped there would end exactly
    // where the interesting part starts.
    resetVoiceDiagnosticsForTests()
    initVoiceDiagnostics('')

    expect(voiceDiagnosticsEnabled()).toBe(true)
  })

  it('turns off for ?voicelog=0, without clearing site data', () => {
    initVoiceDiagnostics('?voicelog=1')
    resetVoiceDiagnosticsForTests()

    initVoiceDiagnostics('?voicelog=0')

    expect(voiceDiagnosticsEnabled()).toBe(false)
  })

  it('survives a browser that refuses storage', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied')
      })
    try {
      // Private mode on iOS is exactly where someone reproduces a bug.
      expect(() => initVoiceDiagnostics('?voicelog=1')).not.toThrow()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

describe('what it records', () => {
  beforeEach(() => {
    initVoiceDiagnostics('?voicelog=1')
    info.mockClear()
  })

  it('keeps the session, the event and the detail, and stamps the moment', () => {
    recordVoiceDiagnostic('doze', 3, { quiet: 3 })

    const entry = find('doze')
    expect(entry.session).toBe(3)
    expect(entry.event).toBe('doze')
    expect(entry.detail).toEqual({ quiet: 3 })
    expect(entry.env.visibility).toBe('visible')
    expect(typeof entry.wall).toBe('string')
  })

  it('writes a console line, which is what the dev-log relay collects', () => {
    recordVoiceDiagnostic('start', 1, { afterMs: 12 })

    expect(info).toHaveBeenCalledTimes(1)
    const line = String(info.mock.calls[0][0])
    expect(line).toContain('[voice]')
    expect(line).toContain('start')
    expect(line).toContain('afterMs=12')
  })

  it('counts from the first entry, so the log reads as elapsed time', () => {
    vi.useFakeTimers()
    try {
      recordVoiceDiagnostic('spin-up', 1)
      vi.advanceTimersByTime(4200)
      recordVoiceDiagnostic('doze', 1)

      // The recording starts at zero, whatever its first line happens to be.
      expect(voiceDiagnosticEntries()[0].at).toBe(0)
      // "How long until it went quiet" is the question; epochs do not answer
      // it at a glance on a phone screen.
      expect(find('doze').at - find('spin-up').at).toBe(4200)
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops the oldest rather than growing without limit', () => {
    for (let i = 0; i < 520; i++) recordVoiceDiagnostic('end', i)

    const kept = voiceDiagnosticEntries()
    expect(kept).toHaveLength(500)
    // The newest survive: the end of a stuck session is what is being read.
    expect(kept[kept.length - 1].session).toBe(519)
  })

  it('tells subscribers, and stops when they let go', () => {
    const seen = vi.fn()
    const off = onVoiceDiagnostic(seen)

    recordVoiceDiagnostic('start', 1)
    off()
    recordVoiceDiagnostic('end', 1)

    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('lets the remaining subscribers hear it when one of them throws', () => {
    const good = vi.fn()
    onVoiceDiagnostic(() => {
      throw new Error('panel blew up')
    })
    onVoiceDiagnostic(good)

    recordVoiceDiagnostic('start', 1)

    expect(good).toHaveBeenCalledTimes(1)
  })
})

describe('handing the recording over', () => {
  beforeEach(() => {
    initVoiceDiagnostics('?voicelog=1')
  })

  it('names the device, so a pasted log says which phone it came from', () => {
    recordVoiceDiagnostic('doze', 2, { quiet: 3 })

    const text = formatVoiceDiagnostics()
    expect(text).toContain('MercuryPitch voice diagnostics')
    expect(text).toContain(navigator.userAgent)
    expect(text).toContain('doze')
    expect(text).toContain('quiet=3')
  })

  it('empties on request', () => {
    recordVoiceDiagnostic('start', 1)
    clearVoiceDiagnostics()

    expect(voiceDiagnosticEntries()).toHaveLength(0)
  })

  it('stops recording when switched off', () => {
    setVoiceDiagnosticsEnabled(false)
    recordVoiceDiagnostic('start', 1)

    expect(voiceDiagnosticEntries().map((entry) => entry.event)).not.toContain(
      'start',
    )
  })
})

describe('asking who is holding the microphone', () => {
  function stubMedia(getUserMedia: unknown): void {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: getUserMedia === undefined ? {} : { getUserMedia },
    })
  }

  it('does not touch the microphone unless somebody asked for a recording', async () => {
    const getUserMedia = vi.fn()
    stubMedia(getUserMedia)
    initVoiceDiagnostics('')

    await expect(probeMicrophone()).resolves.toBe('not-probed')

    // Opening the mic uninvited would be a permission prompt in the middle of
    // a song, and on this platform it would also be a new contender for the
    // very thing being measured.
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('reports a free microphone, and gives it straight back', async () => {
    const stop = vi.fn()
    stubMedia(async () => ({ getTracks: () => [{ stop }] }))
    initVoiceDiagnostics('?voicelog=1')

    await expect(probeMicrophone()).resolves.toBe('free')

    // A probe that kept the track would become the second tab it is looking
    // for, and every later answer would be its own fault.
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('names the refusal, which is the whole point of asking', async () => {
    // "Microphone is used in another tab" reaches script as NotReadableError.
    // A recognizer that starts cleanly and then hears nothing looks identical
    // to a broken recognizer until this line says otherwise.
    const held = Object.assign(new Error('busy'), { name: 'NotReadableError' })
    stubMedia(async () => {
      throw held
    })
    initVoiceDiagnostics('?voicelog=1')

    await expect(probeMicrophone()).resolves.toBe('NotReadableError')
  })

  it('says so when the browser has no microphone API at all', async () => {
    stubMedia(undefined)
    initVoiceDiagnostics('?voicelog=1')

    await expect(probeMicrophone()).resolves.toBe('unsupported')
  })
})

describe('announcing to a console that installed late', () => {
  it('says every line recorded so far, not just how the document opened', () => {
    // Through the real door, so `document-open` is in the record the way it
    // is on a device.
    initVoiceDiagnostics('?voicelog=1')
    recordVoiceDiagnostic('warm-up', 0)
    recordVoiceDiagnostic('warm-up-over', 0, { afterMs: 1770 })
    recordVoiceDiagnostic('spin-up', 1)
    info.mockClear()

    announceVoiceDiagnostics()

    // The portable console is a dynamic import, so in a standalone room —
    // where voice control starts during boot rather than on a tap — every
    // one of these was written before anything was capturing. A pasted log
    // from a phone showed a deaf session with no warm-up above it, which is
    // the one thing the experiment needed to read.
    const said = info.mock.calls.map((call) => String(call[0])).join('\n')
    for (const event of ['document-open', 'warm-up', 'warm-up-over', 'spin-up'])
      expect(said, `announce dropped ${event}`).toContain(event)
    expect(said).toContain('afterMs=1770')
  })

  it('stays quiet when the recording is off', () => {
    info.mockClear()
    announceVoiceDiagnostics()

    expect(info).not.toHaveBeenCalled()
  })
})
