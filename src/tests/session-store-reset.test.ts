import { describe, expect, it } from 'vitest'
import { melodyStore } from '@/stores/melody-store'
import { resetAllSessions } from '@/stores/session-store'

describe('resetAllSessions', () => {
  it('clears the in-memory melody library, not just localStorage', () => {
    melodyStore.createNewMelody('Should be wiped')
    expect(Object.keys(melodyStore.getMelodyLibrary().melodies).length).toBe(1)

    resetAllSessions()

    // Previously this only cleared localStorage — the reactive in-memory
    // signal (what the UI actually reads from) stayed stale until a full
    // page reload.
    expect(Object.keys(melodyStore.getMelodyLibrary().melodies).length).toBe(0)
  })
})
