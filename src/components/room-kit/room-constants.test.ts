// ============================================================
// Room constants: the note a room can start from, and Merc at rest
// ============================================================

import { describe, expect, it } from 'vitest'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { offerable, SILENT_VOICE } from './room-constants'

describe('offerable', () => {
  it('offers the hold range to its ends, and nothing past them', () => {
    const notes = [
      HOLD_TARGET_MIN_MIDI - 1,
      HOLD_TARGET_MIN_MIDI,
      HOLD_TARGET_MAX_MIDI,
      HOLD_TARGET_MAX_MIDI + 1,
    ]

    const offered = notes.map(offerable)

    expect(offered).toEqual([false, true, true, false])
  })
})

describe('SILENT_VOICE', () => {
  it('is Merc with no voice to follow: unvoiced, quiet and unsteady at A3', () => {
    // The fixtures' silent Merc stands steady (steady 1); a room's does not.
    expect(SILENT_VOICE).toEqual({
      voiced: false,
      cents: 0,
      level: 0,
      steady: 0,
      midi: 57,
    })
  })
})
