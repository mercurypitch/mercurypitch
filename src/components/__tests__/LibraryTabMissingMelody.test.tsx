// ============================================================
// Clicking a session pill whose melody was deleted
// ============================================================
//
// Deleting a melody leaves the session items that named it in place, so undo
// can put things back. The pill therefore still shows — and clicking it used
// to run `buildSessionItemMelody`, which answered the dangling reference with
// a single middle C and loaded that into the editor under the melody's name.
//
// The build now returns nothing, so the C4 is gone either way. What this file
// pins is the other half: the singer is TOLD why the pill did nothing, and
// which melody it was. Silence would read as a broken button.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaybackSession, SessionItem } from '@/types'

const shown = vi.hoisted(() => ({ messages: [] as string[] }))
const active = vi.hoisted(() => ({ session: null as PlaybackSession | null }))

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    userSession: () => active.session,
    showNotification: (message: string) => shown.messages.push(message),
  }
})

const playback = vi.hoisted(() => ({
  playSessionSequence: vi.fn(),
  loadAndPlayMelodyForSession: vi.fn(),
}))

vi.mock('@/contexts/PlaybackContext', () => ({
  usePlayback: () => playback,
}))

import { LibraryTab } from '@/components/LibraryTab'
import { melodyStore } from '@/stores/melody-store'

const PRESENT_MELODY = {
  id: 'melody-present',
  name: 'Warm-up in D',
  key: 'D',
  scaleType: 'major',
  bpm: 90,
  created: 0,
  items: [
    {
      id: 1,
      note: { midi: 62, name: 'D', octave: 4, freq: 293.66 },
      startBeat: 0,
      duration: 1,
    },
  ],
}

function melodyItem(id: string, label: string, melodyId: string): SessionItem {
  return { id, type: 'melody', startBeat: 0, label, melodyId }
}

beforeEach(() => {
  shown.messages = []
  vi.clearAllMocks()
  melodyStore.restoreMelody(PRESENT_MELODY as never)
  active.session = {
    id: 'sess',
    name: 'Morning set',
    created: 0,
    items: [
      melodyItem('i1', 'Deleted Warm-up', 'melody-gone'),
      melodyItem('i2', 'Warm-up in D', 'melody-present'),
    ],
  } as PlaybackSession
})

/** The pill carrying `label`, from the session item list. */
async function pill(label: string): Promise<HTMLElement> {
  return await waitFor(() => {
    const found = screen
      .getAllByText(label)
      .map((el) => el.closest<HTMLElement>('[class*="pill"]'))
      .find((el): el is HTMLElement => el !== null)
    expect(found).toBeDefined()
    return found as HTMLElement
  })
}

describe('a session pill whose melody was deleted', () => {
  it('says which melody is gone instead of doing nothing', async () => {
    render(() => <LibraryTab />)

    fireEvent.click(await pill('Deleted Warm-up'))

    await waitFor(() =>
      expect(shown.messages).toEqual([
        '“Deleted Warm-up” was deleted. Undo the delete to bring it back.',
      ]),
    )
    // And it does not load anything: the editor keeps whatever was there,
    // rather than gaining a stand-in note under this label.
    expect(playback.loadAndPlayMelodyForSession).not.toHaveBeenCalled()
  })

  it('leaves a pill whose melody is still there alone', async () => {
    render(() => <LibraryTab />)

    fireEvent.click(await pill('Warm-up in D'))

    // No warning at all — the ordinary select path runs, which is the thing
    // the guard above must not have broken.
    await waitFor(() =>
      expect(melodyStore.getCurrentMelody()?.id).toBe('melody-present'),
    )
    expect(shown.messages).toEqual([])
  })

  it('names the item’s own label, since there is no melody left to name', async () => {
    // `itemLabel()` prefers the melody's stored name and falls back to the
    // item's label. For a deleted melody only the fallback exists, and a
    // message reading “” was deleted would be worse than none.
    active.session = {
      id: 'sess',
      name: 'Morning set',
      created: 0,
      items: [melodyItem('i1', 'Scales in A', 'melody-also-gone')],
    } as PlaybackSession

    render(() => <LibraryTab />)
    fireEvent.click(await pill('Scales in A'))

    await waitFor(() =>
      expect(shown.messages).toEqual([
        '“Scales in A” was deleted. Undo the delete to bring it back.',
      ]),
    )
  })
})
