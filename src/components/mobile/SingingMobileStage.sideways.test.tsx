// ============================================================
// The Singing phone stage on its side
// ============================================================
//
// A phone held sideways gets the phone stage too (isPhoneStage in App), and
// there it takes two columns: the song, the scrubber and the transport down
// the left, the notes the full height beside them. The columns are the
// stylesheet's; what decides them is the `sideways` class, set while
// isShortTouchLandscape matches and taken off as the phone turns upright,
// on the same mounted stage, so the canvas and the run carry on. The
// geometry itself is measured in src/e2e/singing-phone-sideways.spec.ts.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { PLAYBACK_MODE_ONCE } from '@/features/tabs/constants'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import type { SingingMobileStageProps } from './SingingMobileStage'
import { SingingMobileStage } from './SingingMobileStage'
import styles from './SingingMobileStage.module.css'

const viewport = vi.hoisted(() => ({
  turn: (_sideways: boolean): void => {},
}))

vi.mock('@/lib/use-viewport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { createSignal } = await import('solid-js')
  const [sideways, setSideways] = createSignal(false)
  viewport.turn = (next) => {
    setSideways(next)
  }
  return {
    ...actual,
    isShortTouchLandscape: sideways,
  }
})

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

beforeEach(() => viewport.turn(false))
afterEach(cleanup)

function picker(): MidiSongPicker {
  return {
    selectedId: () => null,
    setSelectedId: vi.fn(),
    importStatus: () => '',
    isModalOpen: () => false,
    setIsModalOpen: vi.fn(),
    trackModalSong: () => null,
    setTrackModalSong: vi.fn(),
  } as unknown as MidiSongPicker
}

function makeProps(): SingingMobileStageProps {
  return {
    picker: picker(),
    currentBeat: () => 0,
    totalBeats: () => 8,
    onSeekBeat: vi.fn(),
    renderCanvas: () => <canvas data-testid="notes" />,
    liveScore: () => null,
    targetNoteName: () => null,
    micActive: () => false,
    onMicToggle: vi.fn(),
    onOpenZen: vi.fn(),
    isPlaying: () => false,
    isPaused: () => false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    isCountingIn: () => false,
    countInBeat: () => 0,
    playMode: () => PLAYBACK_MODE_ONCE,
    onPlayModeChange: vi.fn(),
    onSessionSkip: vi.fn(),
    onSessionEnd: vi.fn(),
    speed: () => 1,
    onSpeedChange: vi.fn(),
    volume: () => 80,
    onVolumeChange: vi.fn(),
    metronomeEnabled: () => false,
    onMetronomeToggle: vi.fn(),
    onOctaveShift: vi.fn(),
    onAutoCalibrate: vi.fn(),
  }
}

const stage = (): HTMLElement => screen.getByTestId('singing-mobile-stage')
const twoColumns = (): boolean => stage().classList.contains(styles.sideways!)

describe('the Singing phone stage on its side', () => {
  it('takes the two columns as the phone turns, and gives them back upright', () => {
    render(() => <SingingMobileStage {...makeProps()} />)
    const notes = screen.getByTestId('notes')
    const seen = [twoColumns()]

    viewport.turn(true)
    seen.push(twoColumns())
    viewport.turn(false)
    seen.push(twoColumns())

    // One stage throughout: the canvas was never put down and drawn again.
    expect({ seen, sameCanvas: screen.getByTestId('notes') === notes }).toEqual(
      { seen: [false, true, false], sameCanvas: true },
    )
  })

  it('keeps every control a singer needs on the stage it lays out', () => {
    viewport.turn(true)
    render(() => <SingingMobileStage {...makeProps()} />)

    const names = [
      'Choose a song',
      'Key, scale and playback options',
      'Start the mic',
      'Play',
      'Practice options',
    ]
    expect(
      names.map((name) =>
        stage().contains(screen.getByRole('button', { name })),
      ),
    ).toEqual(names.map(() => true))
  })
})
