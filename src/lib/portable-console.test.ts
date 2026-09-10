// ============================================================
// portable-console
// ============================================================
// This exists to answer a question on a device that cannot open an inspector,
// so the properties worth pinning are the ones that decide whether the answer
// arrives at all: the capture survives the page load being measured, it never
// grows without bound, it never swallows the real console, and it cannot be
// installed twice onto itself.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPortableConsole, formatPortableConsole, formatPortableConsoleEntry, initPortableConsoleVisibility, installPortableConsole, onPortableConsole, portableConsoleEntries, portableConsoleVisible, recordPortableConsole, resetPortableConsoleForTests, setPortableConsoleVisible, } from './portable-console'

// The keys a PREVIOUS document wrote. Spelled out on purpose: this is the
// contract across a navigation, and a rename that silently drops the log is
// exactly the failure these tests are here to catch.
const PERSIST_KEY = 'mp:portableConsole:log'
const PERSIST_ORIGIN_KEY = 'mp:portableConsole:origin'

let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  resetPortableConsoleForTests()
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  // Uninstall BEFORE restoring: the wrapper is holding the spy, and putting
  // the real console back underneath a live wrapper leaves both in place.
  resetPortableConsoleForTests()
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

describe('capturing', () => {
  it('records what the console was told, and still tells the console', () => {
    installPortableConsole()

    console.log('tuning to', 440)

    const [entry] = portableConsoleEntries()
    expect(entry.level).toBe('log')
    expect(entry.text).toBe('tuning to 440')
    // Calling through is not optional: the dev-server relay reads the real
    // console, and swallowing output would trade one blind spot for another.
    expect(logSpy).toHaveBeenCalledWith('tuning to', 440)
  })

  it('installs once, however many entries ask for it', () => {
    installPortableConsole()
    const wrapped = console.log
    installPortableConsole()

    console.log('one line')

    // Seven entry points call setup, and a wrapper around a wrapper records
    // every line twice — then four times, then the tab stops responding.
    expect(console.log).toBe(wrapped)
    expect(portableConsoleEntries()).toHaveLength(1)
  })

  it('survives an object that refers to itself', () => {
    installPortableConsole()
    const loop: Record<string, unknown> = { name: 'session' }
    loop.self = loop

    expect(() => console.log(loop)).not.toThrow()

    expect(portableConsoleEntries()[0].text).toContain('[circular]')
  })

  it('keeps an Error readable instead of logging an empty object', () => {
    recordPortableConsole('error', [new TypeError('no such track')])

    expect(portableConsoleEntries()[0].text).toBe('TypeError: no such track')
  })

  it('catches what never reached the console at all', () => {
    installPortableConsole()

    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'undefined is not an object',
        filename: 'app.js',
        lineno: 12,
        colno: 3,
      }),
    )

    const [entry] = portableConsoleEntries()
    expect(entry.level).toBe('onerror')
    expect(entry.text).toContain('undefined is not an object')
    expect(entry.text).toContain('app.js:12:3')
  })

  it('drops the oldest rather than filling the phone', () => {
    for (let i = 0; i < 1020; i++) recordPortableConsole('log', [`line ${i}`])

    const kept = portableConsoleEntries()
    expect(kept).toHaveLength(1000)
    // The newest survive: whatever just went wrong is the reason anyone is
    // reading this.
    expect(kept[kept.length - 1].text).toBe('line 1019')
  })

  it('truncates one runaway line instead of losing the rest', () => {
    recordPortableConsole('log', ['x'.repeat(5000)])

    expect(portableConsoleEntries()[0].text).toHaveLength(2000)
  })

  it('puts the console back when uninstalled', () => {
    const before = console.log
    const uninstall = installPortableConsole()

    uninstall()

    expect(console.log).toBe(before)
  })
})

describe('crossing a page load', () => {
  it('writes the capture down before the document goes away', () => {
    installPortableConsole()
    console.log('the last thing before Karaoke Night')

    // A navigation is the one moment a debounce timer will not fire.
    window.dispatchEvent(new Event('pagehide'))

    expect(String(sessionStorage.getItem(PERSIST_KEY))).toContain(
      'the last thing before Karaoke Night',
    )
  })

  it('picks up what the previous document left, on one clock', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
      // Karaoke Night is a separate document. Without this, the log is empty
      // on the far side of the only transition worth watching — which is what
      // the phone reported on 2026-09-10: `entries: 0`.
      sessionStorage.setItem(
        PERSIST_KEY,
        JSON.stringify([{ at: 0, level: 'log', text: 'before the walk' }]),
      )
      sessionStorage.setItem(PERSIST_ORIGIN_KEY, String(Date.now() - 5000))

      installPortableConsole()
      console.log('after the walk')

      const kept = portableConsoleEntries()
      expect(kept.map((entry) => entry.text)).toEqual([
        'before the walk',
        'after the walk',
      ])
      // One timeline across three documents, or the transition cannot be read.
      expect(kept[1].at).toBe(5000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts clean when the stored value is nonsense', () => {
    sessionStorage.setItem(PERSIST_KEY, 'not json{')

    expect(() => installPortableConsole()).not.toThrow()
    expect(portableConsoleEntries()).toHaveLength(0)
  })

  it('survives a browser that refuses storage', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    try {
      // Private mode on iOS is exactly where someone reproduces a bug.
      installPortableConsole()
      console.log('still worth having')
      expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow()

      expect(portableConsoleEntries()).toHaveLength(1)
    } finally {
      setItem.mockRestore()
    }
  })

  it('forgets both copies when cleared', () => {
    installPortableConsole()
    console.log('noise')
    window.dispatchEvent(new Event('pagehide'))

    clearPortableConsole()

    expect(portableConsoleEntries()).toHaveLength(0)
    // Clearing only the visible half would resurrect the log on the next page.
    expect(sessionStorage.getItem(PERSIST_KEY)).toBeNull()
  })
})

describe('getting out of the way', () => {
  it('is shown by default, because the build flag was set on purpose', () => {
    initPortableConsoleVisibility('')

    expect(portableConsoleVisible()).toBe(true)
  })

  it('hides for ?console=0 and remembers across the next page load', () => {
    initPortableConsoleVisibility('?console=0')
    resetPortableConsoleForTests()

    initPortableConsoleVisibility('')

    expect(portableConsoleVisible()).toBe(false)
  })

  it('comes back for ?console=1', () => {
    initPortableConsoleVisibility('?console=0')

    initPortableConsoleVisibility('?console=1')

    expect(portableConsoleVisible()).toBe(true)
  })

  it('tells subscribers when it is dismissed', () => {
    const seen = vi.fn()
    onPortableConsole(seen)

    setPortableConsoleVisible(false)

    expect(seen).toHaveBeenCalledTimes(1)
    expect(portableConsoleVisible()).toBe(false)
  })

  it('lets the remaining subscribers hear it when one of them throws', () => {
    const good = vi.fn()
    onPortableConsole(() => {
      throw new Error('panel blew up')
    })
    onPortableConsole(good)

    recordPortableConsole('log', ['anything'])

    expect(good).toHaveBeenCalledTimes(1)
  })

  it('stops telling a subscriber that let go', () => {
    const seen = vi.fn()
    const off = onPortableConsole(seen)

    recordPortableConsole('log', ['one'])
    off()
    recordPortableConsole('log', ['two'])

    expect(seen).toHaveBeenCalledTimes(1)
  })
})

describe('handing it over', () => {
  it('names the device, so a pasted log says which phone it came from', () => {
    recordPortableConsole('warn', ['recognition ended, quiet'])

    const text = formatPortableConsole()
    expect(text).toContain('MercuryPitch portable console')
    expect(text).toContain(navigator.userAgent)
    expect(text).toContain('lines: 1')
    expect(text).toContain('recognition ended, quiet')
  })

  it('says so when the oldest lines were dropped', () => {
    for (let i = 0; i < 1000; i++) recordPortableConsole('log', [`line ${i}`])

    // Reading a truncated log as a complete one is how an investigation ends
    // up chasing a beginning that was never captured.
    expect(formatPortableConsole()).toContain('(oldest dropped)')
  })

  it('reads as elapsed time and shouts the level', () => {
    const line = formatPortableConsoleEntry({
      at: 4200,
      level: 'error',
      text: 'boom',
    })

    expect(line).toContain('4.20s')
    expect(line).toContain('ERROR')
    expect(line).toContain('boom')
  })
})
