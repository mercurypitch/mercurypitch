// ============================================================
// The sequencer meets a session item whose melody was deleted
// ============================================================
//
// The defect: deleting a melody deliberately leaves every session item that
// referenced it in place, so that `restoreMelody` — the undo directly below
// `deleteMelody` — can put things back. But `buildSessionItemMelody` answered
// the dangling reference with a single middle C, and the sequencer played and
// SCORED that C under the label of the melody the singer had written. Nothing
// anywhere said the melody was gone.
//
// What is asserted is what the singer experiences: the runtime is never handed
// a stand-in note, they are told which item was skipped, and the session
// continues to the item after it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MelodyItem, SessionItem } from '@/types'

const notifications = vi.hoisted(() => ({ shown: [] as string[] }))
const session = vi.hoisted(() => ({
  items: [] as SessionItem[],
  index: 0,
}))

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    showNotification: (message: string) => notifications.shown.push(message),
    getCurrentSessionItem: () => session.items[session.index],
    advanceSessionItem: () => {
      session.index += 1
      return session.items[session.index]
    },
    sessionItemIndex: () => session.index,
    countIn: () => 0,
    recordSessionItemResult: () => {},
    setActiveTab: () => {},
    setBpm: () => {},
    setKeyName: () => {},
    setScaleType: () => {},
    setSessionActive: () => {},
    userSession: () => null,
  }
})

import { useSessionSequencer } from '@/features/session/useSessionSequencer'
import { melodyStore } from '@/stores/melody-store'

/** Notes handed to the playback runtime, in order. */
let played: MelodyItem[][]

function makeSequencer(): ReturnType<typeof useSessionSequencer> {
  played = []
  const runtime = {
    stop: () => {},
    start: () => {},
    setMelody: (items: MelodyItem[]) => played.push(items),
    setDurationBeats: () => {},
    getBPM: () => 120,
  }
  return useSessionSequencer({
    playbackRuntime: runtime as never,
    practiceEngine: { resetSession: () => {} } as never,
    liveScore: () => null,
    practiceResult: () => null,
    setPitchHistory: (() => {}) as never,
    setNoteResults: (() => {}) as never,
    setLiveScore: (() => {}) as never,
    setPlaybackDisplayMelody: () => {},
    setPlaybackDisplayBeats: () => {},
    handleStop: async () => null,
    handlePlay: () => {},
    setPlayMode: (() => {}) as never,
    closeSidebar: () => {},
    currentRepeat: () => 1,
    setCurrentRepeat: (() => {}) as never,
    repeatCycles: () => 1,
    buildScaleMelody: () => {},
    setCurrentBeat: (() => {}) as never,
    setCurrentNoteIndex: (() => {}) as never,
  })
}

const PRESENT_MELODY = {
  id: 'melody-b',
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
    {
      id: 2,
      note: { midi: 64, name: 'E', octave: 4, freq: 329.63 },
      startBeat: 1,
      duration: 1,
    },
  ],
}

function melodyItem(id: string, label: string, melodyId: string): SessionItem {
  return { id, type: 'melody', startBeat: 0, label, melodyId }
}

beforeEach(() => {
  notifications.shown = []
  session.index = 0
  melodyStore.restoreMelody(PRESENT_MELODY as never)
})

describe('a session item whose melody was deleted', () => {
  beforeEach(() => {
    session.items = [
      melodyItem('i1', 'Deleted Warm-up', 'melody-a-deleted'),
      melodyItem('i2', 'Warm-up in D', 'melody-b'),
    ]
  })

  it('is never played as a stand-in note', async () => {
    // THE REGRESSION. Pre-fix `played[0]` was a single note at midi 60 — one
    // middle C, scored under the label 'Deleted Warm-up'.
    const sequencer = makeSequencer()

    sequencer.loadNextSessionItem()

    expect(played).toEqual([])
    await vi.waitFor(() => expect(session.index).toBe(1))
  })

  it('says which item it skipped, by name', async () => {
    const sequencer = makeSequencer()

    sequencer.loadNextSessionItem()

    await vi.waitFor(() =>
      expect(notifications.shown).toEqual([
        'Skipping “Deleted Warm-up” — that melody was deleted.',
      ]),
    )
  })

  it('carries on to the item after it', async () => {
    const sequencer = makeSequencer()

    sequencer.loadNextSessionItem()

    // The skip advances the session and loads the next item, which is intact.
    await vi.waitFor(() => expect(played).toHaveLength(1))
    expect(played[0].map((i) => i.note.midi)).toEqual([62, 64])
  })

  it('plays the item normally once the delete is undone', async () => {
    melodyStore.restoreMelody({
      ...PRESENT_MELODY,
      id: 'melody-a-deleted',
      name: 'Deleted Warm-up',
      items: [
        {
          id: 3,
          note: { midi: 67, name: 'G', octave: 4, freq: 392 },
          startBeat: 0,
          duration: 1,
        },
      ],
    } as never)

    const sequencer = makeSequencer()
    sequencer.loadNextSessionItem()

    expect(played).toHaveLength(1)
    expect(played[0].map((i) => i.note.midi)).toEqual([67])
    expect(notifications.shown).toEqual([])
    melodyStore.deleteMelody('melody-a-deleted')
  })
})

describe('loadAndPlayMelodyForSession', () => {
  beforeEach(() => {
    session.items = []
  })

  it('tells the singer when the pill points at nothing', () => {
    // It used to `return` in silence, so pressing the pill did nothing at all
    // and there was no way to tell that from a bug.
    const sequencer = makeSequencer()

    sequencer.loadAndPlayMelodyForSession('melody-a-deleted')

    expect(notifications.shown).toEqual(['That melody was deleted.'])
    expect(played).toEqual([])
  })

  it('loads one that is still there', () => {
    const sequencer = makeSequencer()

    sequencer.loadAndPlayMelodyForSession('melody-b')

    expect(notifications.shown).toEqual([])
    expect(played).toHaveLength(1)
    expect(played[0].map((i) => i.note.midi)).toEqual([62, 64])
  })
})
