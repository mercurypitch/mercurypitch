// ============================================================
// Pressing Play on a session whose melodies were deleted
// ============================================================
//
// Deleting a melody deliberately leaves every session item that named it in
// place, so `restoreMelody` can put things back. `buildSessionItemMelody`
// therefore answers a dangling reference with nothing at all — and the
// controller, not the sequencer, is what builds the FIRST item of a session.
//
// `firstPlayableSessionIndex` skips a leading run of deleted melodies. This
// file is about what happens at the end of that run: when it reaches past the
// last item, there is no first item to load, and the controller's ordinary
// "nothing loaded, generate a scale" fallback would start an eight-note scale
// and score the singer against it under this session's name.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MelodyItem, PlaybackSession, SessionItem } from '@/types'

const notifications = vi.hoisted(() => ({ shown: [] as string[] }))
const store = vi.hoisted(() => ({
  session: null as PlaybackSession | null,
  mode: false,
  itemIndex: 0,
  seeded: 0,
  activated: 0,
}))

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    userSession: () => store.session,
    sessionMode: () => store.mode,
    setSessionMode: (v: boolean) => {
      store.mode = v
    },
    setSessionActive: (v: boolean) => {
      store.activated += v ? 1 : 0
    },
    setSessionItemIndex: (v: number) => {
      store.itemIndex = v
    },
    setSessionItemRepeat: () => {},
    startPracticeSession: () => {
      store.seeded += 1
    },
    countIn: () => 0,
    bpm: () => 120,
    keyName: () => 'C',
    scaleType: () => 'major',
    settings: () => ({}),
    setActiveTab: () => {},
    setActiveUserSession: () => {},
    setBpm: () => {},
    setKeyName: () => {},
    setScaleType: () => {},
  }
})

vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string) => notifications.shown.push(message),
}))

vi.mock('@/lib/audio-unlock', () => ({
  activateAudioPlayback: async () => {},
}))

import { usePlaybackController } from '@/features/playback/usePlaybackController'
import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { melodyStore } from '@/stores/melody-store'

/** Everything handed to the playback runtime, in order. */
let played: MelodyItem[][]
/** Scales the controller asked to generate as a fallback. */
let scalesBuilt: number

function makeController(): ReturnType<typeof usePlaybackController> {
  played = []
  scalesBuilt = 0
  const runtime = {
    stop: () => {},
    start: () => {},
    setMelody: (items: MelodyItem[]) => played.push(items),
    setDurationBeats: () => {},
    getBPM: () => 120,
    on: () => {},
    seekToBeat: () => {},
  }
  return usePlaybackController({
    audioEngine: {} as never,
    playbackRuntime: runtime as never,
    practiceEngine: { startSession: () => {} } as never,
    playMode: () => PLAYBACK_MODE_SESSION,
    setPlayMode: (() => {}) as never,
    practiceSubMode: () => 'all',
    setPitchHistory: (() => {}) as never,
    setNoteResults: (() => {}) as never,
    setPracticeResult: (() => {}) as never,
    setLiveScore: (() => {}) as never,
    closeSidebar: () => {},
    filterMelodyForPractice: (m) => m,
    buildSessionPlaybackMelody: (() => ({
      items: [],
      durationBeats: 0,
    })) as never,
    // The real one fills melodyStore with a generated scale, which is exactly
    // how an empty session start turns into eight notes to sing. A stub that
    // only counted the call would hide the consequence.
    buildScaleMelody: () => {
      scalesBuilt += 1
      melodyStore.setMelody(
        Array.from({ length: 8 }, (_, i) => ({
          id: 1000 + i,
          note: { midi: 60 + i, name: 'C', octave: 4, freq: 261.63 },
          startBeat: i,
          duration: 1,
        })) as never,
      )
    },
    isRecording: () => false,
    finalizeRecording: () => {},
    totalBeats: () => 0,
    endPracticeSession: () => null,
    setShouldAutoStartPlayback: (() => {}) as never,
  })
}

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

function sessionOf(items: SessionItem[]): PlaybackSession {
  return { id: 'sess', name: 'Morning set', items } as PlaybackSession
}

beforeEach(() => {
  notifications.shown = []
  store.session = null
  store.mode = false
  store.itemIndex = 0
  store.seeded = 0
  store.activated = 0
  melodyStore.restoreMelody(PRESENT_MELODY as never)
  // The editor is empty, which is the ordinary state on a fresh Play from the
  // session tab — and the state in which the fallback below generates a scale.
  melodyStore.setMelody([])
})

describe('pressing Play on a session', () => {
  it('starts on the first item that still has its melody', () => {
    store.session = sessionOf([
      melodyItem('i1', 'Deleted Warm-up', 'gone'),
      melodyItem('i2', 'Warm-up in D', 'melody-present'),
    ])

    makeController().handlePlay()

    expect(store.itemIndex).toBe(1)
    expect(notifications.shown).toEqual([
      'Skipping “Deleted Warm-up” — that melody was deleted.',
    ])
    // The real melody, not a stand-in: one D4, exactly what was restored.
    expect(played.at(-1)?.map((i) => i.note.midi)).toEqual([62])
    expect(scalesBuilt).toBe(0)
  })

  it('refuses to start at all when every melody is gone', () => {
    // THE DEFECT. Skipping past the last item leaves no first item to load,
    // and the controller's ordinary fallback generates an eight-note scale —
    // so Play started a scale under this session's name and the practice
    // engine scored it. Nothing must start.
    store.session = sessionOf([
      melodyItem('i1', 'Deleted Warm-up', 'gone'),
      melodyItem('i2', 'Deleted Riff', 'also-gone'),
    ])

    const controller = makeController()
    controller.handlePlay()

    expect(notifications.shown).toEqual([
      'Every melody in this session was deleted. Undo the delete to play it again.',
    ])
    expect(played).toEqual([])
    expect(scalesBuilt).toBe(0)
    expect(controller.isPlaying()).toBe(false)
    // And no session was seeded, so the transport is not left mid-session
    // with an index past the end of its own item list.
    expect(store.seeded).toBe(0)
    expect(store.mode).toBe(false)
    expect(store.itemIndex).toBe(0)
  })

  it('says nothing and plays normally when the first item is intact', () => {
    store.session = sessionOf([
      melodyItem('i1', 'Warm-up in D', 'melody-present'),
    ])

    makeController().handlePlay()

    expect(notifications.shown).toEqual([])
    expect(store.itemIndex).toBe(0)
    expect(played.at(-1)?.map((i) => i.note.midi)).toEqual([62])
  })
})
