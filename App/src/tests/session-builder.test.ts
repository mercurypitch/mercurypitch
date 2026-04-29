// ============================================================
// Session Builder Tests
// Validates the pure helpers used by controllers and the LibraryTab.
// ============================================================

import { describe, expect, it, vi } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import { buildScaleMelody, buildSessionItemMelody, buildSessionPlaybackMelody, } from '@/lib/session-builder'
import { melodyStore } from '@/stores/melody-store'
import type { PlaybackSession, SessionItem } from '@/types'

describe('buildSessionItemMelody', () => {
  it('returns notes for a scale item', () => {
    const item: SessionItem = {
      id: 's1',
      type: 'scale' as 'rest',
      startBeat: 0,
      label: 'C Major',
      scaleType: 'major',
      beats: 8,
    }
    const built = buildSessionItemMelody(item)
    expect(built.length).toBeGreaterThan(0)
    // Each item should be a MelodyItem with a note.
    expect(built[0].note).toBeDefined()
    expect(built[0].note.midi).toBeGreaterThan(0)
  })

  it('returns empty for a rest item', () => {
    const item: SessionItem = {
      id: 'r1',
      type: 'rest',
      startBeat: 0,
      label: 'Rest',
      restMs: 1000,
    }
    expect(buildSessionItemMelody(item)).toEqual([])
  })

  it('falls back to a single note for unknown payloads', () => {
    const item: SessionItem = {
      id: 'u1',
      type: 'melody',
      startBeat: 0,
      label: 'Missing',
      melodyId: 'does-not-exist',
    }
    const built = buildSessionItemMelody(item)
    expect(built.length).toBeGreaterThan(0)
  })
})

describe('buildSessionPlaybackMelody', () => {
  it('concatenates all session items, shifting startBeats sequentially', () => {
    const session: PlaybackSession = {
      id: 'concat',
      name: 'Concat',
      created: Date.now(),
      deletable: true,
      items: [
        {
          id: 'a',
          type: 'scale' as 'rest',
          startBeat: 0,
          label: 'A',
          scaleType: 'major',
          beats: 4,
        },
        {
          id: 'b',
          type: 'scale' as 'rest',
          startBeat: 0,
          label: 'B',
          scaleType: 'major',
          beats: 4,
        },
      ],
    }
    const { items, durationBeats } = buildSessionPlaybackMelody(session)
    expect(items.length).toBeGreaterThan(0)
    expect(durationBeats).toBeGreaterThan(0)
    // Items must be sorted by startBeat ascending.
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startBeat).toBeGreaterThanOrEqual(items[i - 1].startBeat)
    }
  })

  it('advances offset for rest items', () => {
    const session: PlaybackSession = {
      id: 'rest',
      name: 'Rest',
      created: Date.now(),
      deletable: true,
      items: [
        {
          id: 'r',
          type: 'rest',
          startBeat: 0,
          label: 'Rest',
          restMs: 2000,
        },
      ],
    }
    const { items, durationBeats } = buildSessionPlaybackMelody(session)
    expect(items).toEqual([])
    // Rest still advances duration so the playback runtime knows to wait.
    expect(durationBeats).toBeGreaterThan(0)
  })
})

describe('buildScaleMelody', () => {
  it('writes scale items into the melody store', () => {
    melodyStore.setMelody([])
    expect(melodyStore.items()).toHaveLength(0)
    buildScaleMelody('major', 8)
    expect(melodyStore.items().length).toBeGreaterThan(0)
  })
})
