import { beforeEach, describe, expect, it, vi } from 'vitest'
import { melodyStore } from '@/stores/melody-store'
import { createMelodyItem, createSession } from '@/stores/session-store'
import { buildSessionItemMelody } from '@/lib/session-builder'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('REPRO: deleteMelody leaves dangling session refs', () => {
  beforeEach(() => {
    localStorageMock.clear()
    melodyStore.resetMelodyLibrary()
  })

  it('session keeps melodyId after melody deleted; playback falls back to C4', () => {
    const a = melodyStore.createNewMelody('A')
    const c = melodyStore.createNewMelody('C')
    // give C real notes
    melodyStore.updateMelody(c.id, {
      items: [
        {
          id: 1,
          note: { midi: 67, name: 'G', octave: 4, freq: 392.0 },
          startBeat: 0,
          duration: 1,
        },
        {
          id: 2,
          note: { midi: 69, name: 'A', octave: 4, freq: 440.0 },
          startBeat: 1,
          duration: 1,
        },
      ],
    })

    const session = createSession('Practice', [
      createMelodyItem('Melody A', a.id, 0),
      createMelodyItem('My Riff In G', c.id, 8),
    ])
    console.log('session id:', session.id)

    // sanity: before deletion the item builds C's real notes
    const before = buildSessionItemMelody(session.items[1])
    console.log('BEFORE delete, built notes:', JSON.stringify(before.map((n) => n.note.midi)))

    melodyStore.deleteMelody(c.id)

    const lib = melodyStore.getMelodyLibrary()
    const stored = lib.sessions[session.id]
    console.log('session still in library.sessions?', stored !== undefined)
    console.log('stored items:', JSON.stringify(stored?.items))
    console.log('melody C gone?', melodyStore.getMelody(c.id) === undefined)

    const after = buildSessionItemMelody(session.items[1])
    console.log('AFTER delete, built notes:', JSON.stringify(after.map((n) => ({ midi: n.note.midi, dur: n.duration }))))
    expect(true).toBe(true)
  })
})
