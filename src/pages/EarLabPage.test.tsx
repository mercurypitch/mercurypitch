// ============================================================
// The Ear Lab page opens the drill another part of the app asks for on
// the lesson's set the request carries (an `ear-drill` slug): the set's
// pads only, and the words that say so. A set the drill cannot make opens
// it whole, a request for the drill already open opens it afresh on the
// set, and the bench opens a drill whole again.
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { EarDrillLaunch } from '@/features/exercises/slug-map'
import { EXERCISE_SLUGS } from '@/features/exercises/slug-map'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { resetEarLabStore } from '@/stores/ear-lab-store'
import { pendingEarDrill, pendingEarItems, startEarDrill, } from '@/stores/ui-store'
import { EarLabPage } from './EarLabPage'

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
vi.mock('@/lib/drum-voices', () => ({ triggerDrumVoice: vi.fn() }))

const param = () => ({
  value: 1,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
})
const ctx = {
  currentTime: 1,
  destination: {},
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  })),
  createGain: vi.fn(() => ({
    gain: param(),
    context: { currentTime: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}
const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ctx,
  getVolume: () => 0.8,
  setToneTrim: vi.fn(),
  playTone: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  playChord: vi.fn().mockResolvedValue(undefined),
  stopTone: vi.fn(),
}

function renderPage(): void {
  render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      <EarLabPage />
    </EngineContext.Provider>
  ))
}

const stage = () => screen.getByTestId('ear-stage')
/** The note a lesson's set says at idle, or null for the whole drill. */
const setNote = (): string | null =>
  screen.queryByText(/^Only .* this time/)?.textContent ?? null
const padLabels = () =>
  within(screen.getByTestId('ear-stage-pads'))
    .getAllByRole('button')
    .map((pad) => pad.textContent ?? '')

const PERFECT_AND_TRITONE = ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8']

/** Each ear-drill slug of the registry, by name. */
const EAR_SLUGS = Object.entries(EXERCISE_SLUGS).flatMap(([slug, launch]) =>
  launch.kind === 'ear-drill' ? [[slug, launch] as const] : [],
)

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.clearAllMocks()
  // jsdom has no media playback for the play pads' silent priming.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.resolve(),
  )
})

afterEach(() => {
  cleanup()
})

describe('EarLabPage, asked for a drill on a set', () => {
  it('opens Leap on the perfect intervals and the tritone, four pads only', async () => {
    // Arrange: asked before the page is drawn, as a cold load asks.
    startEarDrill('leap', PERFECT_AND_TRITONE)
    renderPage()
    expect(stage().dataset.earDrill).toBe('leap')
    expect(setNote()).toBe(
      'Only P4, TT, P5 and P8 this time, four of the twelve. Rated on their own: your Leap rating stays as it is.',
    )

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await Promise.resolve()

    // Assert
    expect(padLabels()).toEqual([
      expect.stringContaining('Perfect 4th'),
      expect.stringContaining('Tritone'),
      expect.stringContaining('Perfect 5th'),
      expect.stringContaining('Octave'),
    ])
    // The request is spent: coming back to the tab is not asked again.
    expect([pendingEarDrill(), pendingEarItems()]).toEqual([null, null])
  })

  it.each(EAR_SLUGS)(
    'opens %s on its drill, saying what the set asks',
    (_slug, launch: EarDrillLaunch) => {
      startEarDrill(launch.drill, launch.items)
      renderPage()

      expect(stage().dataset.earDrill).toBe(launch.drill)
      expect(setNote()).toMatch(/Rated on their own: your .+ rating stays/)
    },
  )

  it('opens Leap whole for items that make no set of it', async () => {
    startEarDrill('leap', ['leap:P4', 'leap:P11'])
    renderPage()
    expect(stage().dataset.earDrill).toBe('leap')
    expect(setNote()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await Promise.resolve()

    expect(padLabels()).toHaveLength(12)
  })

  it('opens the drill already on the stage afresh on the set asked for', () => {
    // Leap whole, from inside the app; then a link asks for its set.
    renderPage()
    startEarDrill('leap')
    expect(setNote()).toBeNull()

    startEarDrill('leap', PERFECT_AND_TRITONE)

    expect(stage().dataset.earDrill).toBe('leap')
    expect(setNote()).toMatch(/^Only P4, TT, P5 and P8/)
  })

  it('opens the drill whole from the bench after a set', () => {
    startEarDrill('leap', PERFECT_AND_TRITONE)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the bench' }))

    // The bench's instruments are buttons in a list.
    fireEvent.click(screen.getByRole('listitem', { name: /^Leap: / }))

    expect(stage().dataset.earDrill).toBe('leap')
    expect(setNote()).toBeNull()
  })
})
