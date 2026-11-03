// ============================================================
// Vocal range auto-detect reads only the notes that were sung
// ============================================================
//
// The Auto-detect button sets the range preset from the singer's history.
// A note the practice engine heard no pitch for is graded 'off' with 0 cents
// (noteWasSung), and its target says nothing of the singer's voice: a session
// of high notes nobody sang would read as a high range. Session mode records
// its sessions, so such notes reach the history.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocalRangeSelector } from '@/components/VocalRangeSelector'
import { setSessionResults } from '@/stores/practice-session-store'
import { seedSessionWithNotes } from './utils/session-fixtures'

const AUTO_DETECT = 'Auto-detect from your singing history'

const sung = (count: number, midi: number) =>
  Array.from({ length: count }, () => ({ midi, avgCents: 10 }))

beforeEach(() => setSessionResults([]))
afterEach(cleanup)

describe('VocalRangeSelector auto-detect', () => {
  it('offers to detect a range from ten sung notes', () => {
    seedSessionWithNotes(sung(10, 60))
    const { queryByTitle } = render(() => <VocalRangeSelector />)

    expect(queryByTitle(AUTO_DETECT)).not.toBeNull()
  })

  it('counts no note the singer never sang', () => {
    seedSessionWithNotes([
      ...sung(9, 60),
      ...Array.from({ length: 12 }, () => ({
        midi: 84,
        avgCents: 0,
        rating: 'off' as const,
      })),
    ])
    const { queryByTitle } = render(() => <VocalRangeSelector />)

    expect(queryByTitle(AUTO_DETECT)).toBeNull()
  })
})
