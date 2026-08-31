// ============================================================
// The Field Book: the bench card, the song page and the three
// drills on a primed reading, rated on the wild tracks only.
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import type { AudioEngine } from '@/lib/audio-engine'
import type { WildBook } from '@/lib/ear/wild'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earItemStates, earPlayerRating, resetEarLabStore, } from '@/stores/ear-lab-store'
import type * as UiStore from '@/stores/ui-store'
import { setActiveTab } from '@/stores/ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { FieldBookCard } from './FieldBookCard'
import { FieldBookView } from './FieldBookView'
import type { WildReading } from './wild-analysis'
import { playExcerpt } from './wild-player'
import { primeWildReading, resetWildStore, setFieldBookSessionId, } from './wild-store'

const mocks = vi.hoisted(() => ({ sessions: [] as UvrSession[] }))

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
}))
vi.mock('@/db/services/uvr-service', () => ({
  getStemBlobUrl: vi.fn(async () => null),
}))
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => mocks.sessions,
  getUvrSession: (id: string) =>
    mocks.sessions.find((session) => session.sessionId === id),
}))
vi.mock('@/stores/ui-store', async () => {
  const actual = await vi.importActual<typeof UiStore>('@/stores/ui-store')
  return { ...actual, setActiveTab: vi.fn() }
})
vi.mock('./wild-player', () => ({
  playExcerpt: vi.fn(() => ({ done: Promise.resolve(), cancel: vi.fn() })),
}))

function session(
  id: string,
  name: string,
  status: UvrSession['status'] = 'completed',
): UvrSession {
  return {
    sessionId: id,
    status,
    progress: 100,
    createdAt: id.length,
    originalFile: { name, size: 1, mimeType: 'audio/mpeg' },
    outputs: { vocal: 'blob:v', instrumental: 'blob:i' },
  }
}

const BOOK: WildBook = {
  sessionId: 's1',
  key: { tonicPc: 0, mode: 'major', keyName: 'C' },
  home: [
    {
      kind: 'home',
      itemId: 'wild:s1:home:0',
      startS: 0,
      endS: 2,
      degree: 3,
      midi: 64,
    },
  ],
  echo: [
    {
      kind: 'echo',
      itemId: 'wild:s1:echo:0',
      startS: 4,
      endS: 6,
      degrees: [1, 2, 3],
      midis: [60, 62, 64],
      onsetsS: [0.3, 0.6, 0.9],
    },
  ],
  bassline: [
    {
      kind: 'bassline',
      itemId: 'wild:s1:bassline:0',
      startS: 8,
      endS: 12,
      fromDegree: 1,
      toDegree: 5,
      switchS: 2,
    },
  ],
}

const READING: WildReading = {
  book: BOOK,
  stems: {
    vocal: {} as AudioBuffer,
    instrumental: {} as AudioBuffer,
    bass: null,
  },
}

function fakeEngine(): AudioEngine {
  return {
    init: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    getAudioContext: () => ({}) as AudioContext,
    getVolume: () => 0.8,
    setToneTrim: vi.fn(),
    playTone: vi.fn<(...args: unknown[]) => Promise<void>>(
      async () => undefined,
    ),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

function mount(element: () => ReturnType<typeof FieldBookView>) {
  return render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: fakeEngine(),
        practiceEngine: {} as PracticeEngine,
        playbackRuntime: {} as PlaybackRuntime,
        ready: () => true,
      }}
    >
      {element()}
    </EngineContext.Provider>
  ))
}

function status(): string {
  return screen.getByTestId('ear-stage-status').textContent ?? ''
}

async function reach(text: string): Promise<void> {
  for (let i = 0; i < 60 && !status().includes(text); i++) {
    await vi.advanceTimersByTimeAsync(100)
  }
  expect(status()).toContain(text)
}

describe('FieldBookCard', () => {
  beforeEach(() => {
    resetEarLabStore()
    resetWildStore()
    mocks.sessions = []
    vi.mocked(setActiveTab).mockClear()
  })

  it('points at Karaoke Night when there are no songs', () => {
    render(() => <FieldBookCard onOpen={() => undefined} />)
    expect(screen.getByText(/No songs yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Karaoke Night' }))
    expect(setActiveTab).toHaveBeenCalledWith(TAB_KARAOKE)
  })

  it('lists finished separations with what has been read of them', () => {
    mocks.sessions = [
      session('s1', 'Blue Moon.mp3'),
      session('s2', 'Half done.wav', 'processing'),
    ]
    const onOpen = vi.fn()
    render(() => <FieldBookCard onOpen={onOpen} />)
    expect(screen.getByText('Blue Moon')).toBeTruthy()
    expect(screen.queryByText('Half done')).toBeNull()
    expect(screen.getByText('Unread')).toBeTruthy()
    primeWildReading('s1', READING)
    expect(screen.getByText('C major · 3 items')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith('s1')
  })
})

describe('FieldBookView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetEarLabStore()
    resetWildStore()
    mocks.sessions = [session('s1', 'Blue Moon.mp3')]
    primeWildReading('s1', READING)
    setFieldBookSessionId('s1')
    vi.mocked(playExcerpt).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the reading and opens Home in the Wild, rated on wild-home only', async () => {
    mount(() => <FieldBookView onBack={() => undefined} />)
    expect(status()).toContain(
      'C major — 1 landings, 1 phrases, 1 root motions.',
    )
    fireEvent.click(screen.getByRole('button', { name: /Home in the Wild/ }))
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await reach('Which degree of the song')
    expect(playExcerpt).toHaveBeenCalledTimes(1)
    const [, layers, startS, endS] = vi.mocked(playExcerpt).mock.calls[0]
    expect(layers).toHaveLength(2)
    expect([startS, endS]).toEqual([0, 2])
    fireEvent.click(screen.getByRole('button', { name: /3 Mi$/ }))
    expect(status()).toContain('Yes — 3 — Mi.')
    expect(earPlayerRating('wild-home').attempts).toBe(1)
    expect(earPlayerRating('home').attempts).toBe(0)
    expect(earItemStates()['wild:s1:home:0']).toBeUndefined()
  })

  it('Echo in the Wild takes the phrase back on the ladder, 1′ folding to 1', async () => {
    mount(() => <FieldBookView onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /Echo in the Wild/ }))
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await reach('Tap it back on the ladder')
    for (const word of ['1′ Do', 'Re', 'Mi']) {
      fireEvent.click(
        screen.getByRole('button', { name: new RegExp(`${word}$`) }),
      )
    }
    expect(status()).toContain('Yes — Do Re Mi.')
    expect(earPlayerRating('wild-echo').attempts).toBe(1)
    expect(earPlayerRating('echo').attempts).toBe(0)
  })

  it('Bassline in the Wild names the first root and asks for the second', async () => {
    mount(() => <FieldBookView onBack={() => undefined} />)
    fireEvent.click(
      screen.getByRole('button', { name: /Bassline in the Wild/ }),
    )
    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await reach('The root moved from I — to which degree?')
    fireEvent.click(screen.getByRole('button', { name: /V Sol$/ }))
    expect(status()).toContain('Yes — V.')
    expect(earPlayerRating('wild-bassline').attempts).toBe(1)
    expect(earPlayerRating('bassline').attempts).toBe(0)
  })
})
