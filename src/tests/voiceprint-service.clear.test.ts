// ============================================================
// Clearing the voiceprints this device keeps
// ============================================================
//
// The native Storage screen's Clear for voiceprints (S6 step 7). It empties
// the device's own list and nothing else: the account's copies are the
// account's, and a device clear never reaches them.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalVoiceprints, loadLocalVoiceprints, } from '@/db/services/voiceprint-service'

const touched = vi.hoisted(() => ({ db: 0 }))

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'https://api.test' }))
vi.mock('@/db', () => ({
  getDb: async () => {
    touched.db += 1
    throw new Error('a device clear must not reach the account')
  },
}))

const KEY = 'mercurypitch.voiceprints.v1'

function stored(id: string, takenAt: string): object {
  return {
    id,
    takenAt,
    summary: { lowMidi: 48, highMidi: 67 },
    twin: null,
    source: 'mirror',
  }
}

beforeEach(() => {
  localStorage.clear()
  touched.db = 0
})

describe('clearing the device voiceprints', () => {
  it("empties the device's list and says how many went", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        stored('v-1', '2026-09-01T10:00:00Z'),
        stored('v-2', '2026-09-02T10:00:00Z'),
      ]),
    )

    const cleared = clearLocalVoiceprints()

    expect(cleared).toBe(2)
    expect(loadLocalVoiceprints()).toEqual([])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('never reaches the account', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([stored('v-1', '2026-09-01T10:00:00Z')]),
    )

    clearLocalVoiceprints()

    expect(touched.db).toBe(0)
  })
})
