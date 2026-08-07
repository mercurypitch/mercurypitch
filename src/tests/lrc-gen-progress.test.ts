// ============================================================
// LRC gen progress — the autosave, and how much it distrusts
// ============================================================
//
// The reader's job is to refuse. A blob that belongs to lyrics the singer has
// since replaced, or that predates a field, restores onto the current song
// silently and puts times on the wrong lines — which reads as the mapper
// having lost the work rather than as a bad restore.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LrcGenProgressPayload } from '@/features/stem-mixer/lrc-gen-progress'
import { createGenProgressStore, genProgressKey, parseSavedGenProgress, } from '@/features/stem-mixer/lrc-gen-progress'

const LINES = ['hold on', 'soul mate', 'come home']
const IDENTITY = '27:12345'

function payload(over: Partial<LrcGenProgressPayload> = {}) {
  return {
    lineTimes: [1, 5, 9],
    wordTimings: { 0: [1, 3] },
    wordEndTimings: {},
    wordSweepTimings: {},
    lineIdx: 1,
    wordIdx: 0,
    inputMode: 'tap' as const,
    pass: 'all' as const,
    touchedLines: [0],
    lyricsIdentity: IDENTITY,
    timestamp: 0,
    ...over,
  }
}

function parse(raw: unknown, identity = IDENTITY) {
  return parseSavedGenProgress({
    raw: raw === null ? null : JSON.stringify(raw),
    lines: LINES,
    identity,
  })
}

describe('genProgressKey', () => {
  it('is per session, so two open songs cannot overwrite each other', () => {
    expect(genProgressKey('a')).not.toBe(genProgressKey('b'))
  })
})

describe('parseSavedGenProgress', () => {
  it('restores a session it recognises', () => {
    const saved = parse(payload())
    expect(saved?.lineTimes).toEqual([1, 5, 9])
    expect(saved?.lineIdx).toBe(1)
    expect(saved?.inputMode).toBe('tap')
    expect([...(saved?.touchedLines ?? [])]).toEqual([0])
  })

  it('refuses a blob saved against different lyrics', () => {
    expect(parse(payload({ lyricsIdentity: 'other' }))).toBeNull()
  })

  it('accepts a blob from before the identity field existed', () => {
    // Nothing else has ever written this key, so an old blob is still ours.
    const { lyricsIdentity: _drop, ...old } = payload()
    expect(parse(old)).not.toBeNull()
  })

  it('has nothing to restore when nothing was saved', () => {
    expect(parse(null)).toBeNull()
  })

  it('refuses a blob that is not JSON', () => {
    expect(
      parseSavedGenProgress({
        raw: '{ not json',
        lines: LINES,
        identity: IDENTITY,
      }),
    ).toBeNull()
  })

  it('refuses a blob with no line times to restore', () => {
    expect(parse(payload({ lineTimes: [] }))).toBeNull()
    expect(parse(payload({ lineTimes: undefined }))).toBeNull()
  })

  it('pulls a cursor past the end of the song back to the end', () => {
    // The singer can shorten the lyrics between sessions.
    expect(parse(payload({ lineIdx: 99 }))?.lineIdx).toBe(LINES.length)
  })

  it('falls back to the first line for a cursor that is not a line number', () => {
    expect(parse(payload({ lineIdx: 1.5 }))?.lineIdx).toBe(0)
    expect(parse(payload({ lineIdx: -3 }))?.lineIdx).toBe(0)
  })

  it('reports an unknown input mode as absent rather than guessing', () => {
    // Null tells the caller to keep whatever the singer has set now; a guess
    // would silently switch them between tapping and dragging markers.
    expect(
      parse(payload({ inputMode: 'chorded' as never }))?.inputMode,
    ).toBeNull()
  })

  it('gives a pre-pass-split session a pass to resume in', () => {
    const { pass: _drop, ...old } = payload()
    expect(parse(old)?.pass).toBe('all')
  })
})

describe('createGenProgressStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('does not write on every keystroke', () => {
    // A fast word pass fires save several times a second, and localStorage is
    // synchronous — writing each one would stutter the tapping it records.
    const store = createGenProgressStore(() => 'k')
    store.save(payload())
    store.save(payload({ lineIdx: 2 }))
    expect(localStorage.getItem('k')).toBeNull()

    vi.advanceTimersByTime(1500)
    expect(JSON.parse(localStorage.getItem('k') ?? '{}').lineIdx).toBe(2)
    vi.useRealTimers()
  })

  it('writes what was queued when flushed early', () => {
    const store = createGenProgressStore(() => 'k')
    store.save(payload())
    store.flush()
    expect(localStorage.getItem('k')).not.toBeNull()
    vi.useRealTimers()
  })

  it('has nothing to write when nothing was queued', () => {
    const store = createGenProgressStore(() => 'k')
    store.flush()
    expect(localStorage.getItem('k')).toBeNull()
    vi.useRealTimers()
  })

  it('drops a queued write when the session is cleared', () => {
    // Finishing clears the autosave. A timer still pending would write the
    // half-done session back over the top a second later.
    const store = createGenProgressStore(() => 'k')
    store.save(payload())
    store.clear()
    vi.advanceTimersByTime(5000)
    expect(localStorage.getItem('k')).toBeNull()
    vi.useRealTimers()
  })

  it('reads back what it wrote', () => {
    const store = createGenProgressStore(() => 'k')
    store.save(payload())
    store.flush()
    expect(
      parseSavedGenProgress({
        raw: store.read(),
        lines: LINES,
        identity: IDENTITY,
      })?.lineIdx,
    ).toBe(1)
    vi.useRealTimers()
  })

  it('follows the key when the session changes under it', () => {
    let session = 'a'
    const store = createGenProgressStore(() => session)
    store.save(payload())
    store.flush()
    session = 'b'
    expect(store.read()).toBeNull()
    vi.useRealTimers()
  })
})
