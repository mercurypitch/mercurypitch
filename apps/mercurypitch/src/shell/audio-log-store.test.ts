// ============================================================
// The audio record, kept across a restart
// ============================================================
//
// An odd moment noticed later must not be lost when the app is killed: a
// test build keeps the newest entries on the phone, written at most once
// per WRITE_EVERY_MS and at once as the app goes behind, and puts them back
// in front of the next launch's own.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioDiagnosticEntries, clearAudioDiagnostics, formatAudioDiagnostics, recordAudioDiagnostic, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { AUDIO_LOG_KEY, KEEP_ACROSS_LAUNCHES, keepAudioLogAcrossLaunches, WRITE_EVERY_MS, } from './audio-log-store'

/** A phone's storage, as far as the store uses it. */
function phoneStorage(): Storage & { writes: number } {
  const kept = new Map<string, string>()
  return {
    writes: 0,
    get length() {
      return kept.size
    },
    clear: () => kept.clear(),
    getItem: (key) => kept.get(key) ?? null,
    key: (index) => [...kept.keys()][index] ?? null,
    removeItem: (key) => void kept.delete(key),
    setItem(key, value) {
      this.writes += 1
      kept.set(key, value)
    },
  }
}

const stored = (storage: Storage): { event: string }[] =>
  JSON.parse(storage.getItem(AUDIO_LOG_KEY) ?? '[]') as { event: string }[]

const stops: (() => void)[] = []

function keep(storage: Storage): void {
  stops.push(keepAudioLogAcrossLaunches({ storage }))
}

/** The app killed and opened again: a new record, the same storage. */
function relaunch(storage: Storage): void {
  for (const stop of stops.splice(0)) stop()
  resetAudioDiagnosticsForTests()
  keep(storage)
}

function hide(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  resetAudioDiagnosticsForTests()
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  hide(false)
  Reflect.deleteProperty(document, 'visibilityState')
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetAudioDiagnosticsForTests()
})

describe('writing', () => {
  it('writes once per WRITE_EVERY_MS however many entries come', () => {
    const storage = phoneStorage()
    keep(storage)
    for (let i = 0; i < 20; i += 1)
      recordAudioDiagnostic('room', `step-${String(i)}`)
    expect(storage.writes).toBe(0)
    vi.advanceTimersByTime(WRITE_EVERY_MS)
    expect(storage.writes).toBe(1)
    expect(stored(storage)).toHaveLength(20)
  })

  it('runs no timer while nothing happens', () => {
    const storage = phoneStorage()
    keep(storage)
    expect(vi.getTimerCount()).toBe(0)
    recordAudioDiagnostic('room', 'enter')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(WRITE_EVERY_MS)
    expect(vi.getTimerCount()).toBe(0)
  })

  it(`keeps the newest ${String(KEEP_ACROSS_LAUNCHES)}`, () => {
    const storage = phoneStorage()
    keep(storage)
    for (let i = 0; i < KEEP_ACROSS_LAUNCHES + 40; i += 1) {
      recordAudioDiagnostic('room', `step-${String(i)}`)
    }
    vi.advanceTimersByTime(WRITE_EVERY_MS)
    const kept = stored(storage)
    expect(kept).toHaveLength(KEEP_ACROSS_LAUNCHES)
    expect(kept[0]?.event).toBe('step-40')
  })

  it('writes at once as the app goes behind, where iOS may end it', () => {
    const storage = phoneStorage()
    keep(storage)
    recordAudioDiagnostic('app', 'background')
    hide(true)
    expect(storage.writes).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('carries on where storage refuses the write', () => {
    const storage = phoneStorage()
    storage.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
    keep(storage)
    recordAudioDiagnostic('room', 'enter')
    expect(() => vi.advanceTimersByTime(WRITE_EVERY_MS)).not.toThrow()
    expect(audioDiagnosticEntries()).toHaveLength(1)
  })
})

describe('after a restart', () => {
  it('puts the last launch’s entries in front of this one’s, with where they end', () => {
    const storage = phoneStorage()
    keep(storage)
    recordAudioDiagnostic('room', 'enter', { room: 'echo' })
    recordAudioDiagnostic('notice', 'shown', { text: 'Turn it up.' })
    vi.advanceTimersByTime(WRITE_EVERY_MS)

    recordAudioDiagnostic('viewport', 'launch')
    relaunch(storage)

    expect(
      audioDiagnosticEntries().map((e) => `${e.source} ${e.event}`),
    ).toEqual(['room enter', 'notice shown', 'log restored'])
    expect(audioDiagnosticEntries().at(-1)?.detail).toMatchObject({
      entries: 2,
    })
    expect(formatAudioDiagnostics()).toMatch(/notice shown text=Turn it up\./u)
  })

  it('takes nothing from a stored value that is not a record', () => {
    const storage = phoneStorage()
    storage.setItem(AUDIO_LOG_KEY, '{"not":"a list"')
    keep(storage)
    expect(audioDiagnosticEntries()).toEqual([])
    storage.setItem(AUDIO_LOG_KEY, '[{"event":3},null,"x"]')
    relaunch(storage)
    expect(audioDiagnosticEntries()).toEqual([])
  })
})

describe('clearing', () => {
  it('forgets the kept copy too, so the next launch starts clean', () => {
    const storage = phoneStorage()
    keep(storage)
    recordAudioDiagnostic('room', 'enter')
    vi.advanceTimersByTime(WRITE_EVERY_MS)
    recordAudioDiagnostic('room', 'leave')
    clearAudioDiagnostics()
    expect(storage.getItem(AUDIO_LOG_KEY)).toBeNull()
    // The write that was due is not made after the clear.
    vi.advanceTimersByTime(WRITE_EVERY_MS)
    expect(storage.getItem(AUDIO_LOG_KEY)).toBeNull()
    relaunch(storage)
    expect(audioDiagnosticEntries()).toEqual([])
  })
})
