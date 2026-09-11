// ============================================================
// Home drill in mic mode when the microphone is refused: Begin stops
// with the way to tap one press away, and the answer mode changes
// only when the player asks for it.
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { homeAnswerMode, resetEarLabStore, setHomeAnswerMode, } from '@/stores/ear-lab-store'
import { HomeDrill } from './HomeDrill'

const mic = vi.hoisted(() => ({
  acquire: vi.fn<(id: string) => Promise<MediaStream>>(),
  release: vi.fn(),
}))

vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
vi.mock('@/lib/audio-unlock', () => ({
  unlockAudio: vi.fn(async () => undefined),
  activateAudioPlayback: vi.fn(async () => undefined),
}))
vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: (id: string) => mic.acquire(id),
    release: (id: string) => mic.release(id),
  },
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: () => ({
    startTask: vi.fn(),
    takeFrames: () => [],
    peekFrames: () => [],
    latest: () => null,
    latestLevel: () => 0,
    dispose: vi.fn(),
  }),
}))

function fakeEngine(): AudioEngine {
  return {
    init: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    getAudioContext: () => ({}) as AudioContext,
    getVolume: () => 0.8,
    setToneTrim: vi.fn(),
    playTone: vi.fn(async () => undefined),
    playChord: vi.fn().mockResolvedValue(undefined),
    stopTone: vi.fn(),
  } as unknown as AudioEngine
}

function mount() {
  return render(() => (
    <EngineContext.Provider
      value={{
        audioEngine: fakeEngine(),
        practiceEngine: {} as PracticeEngine,
        playbackRuntime: {} as PlaybackRuntime,
        ready: () => true,
      }}
    >
      <HomeDrill onBack={vi.fn()} />
    </EngineContext.Provider>
  ))
}

const begin = () => screen.queryByRole('button', { name: /Begin/ })

describe('HomeDrill when the microphone is refused', () => {
  beforeEach(() => {
    resetEarLabStore()
    setHomeAnswerMode('mic')
    mic.acquire.mockReset()
    mic.release.mockReset()
  })
  afterEach(() => {
    resetEarLabStore()
  })

  it('shows the wait, then stops at Begin in mic mode with Use Tap instead one press away', async () => {
    let refuse: (reason: Error) => void = () => undefined
    mic.acquire.mockImplementation(
      () =>
        new Promise<MediaStream>((_resolve, reject) => {
          refuse = reject
        }),
    )
    mount()

    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    await screen.findByText('Waiting for the microphone…')
    await waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))

    refuse(new DOMException('Permission denied', 'NotAllowedError'))
    await screen.findByText(
      /The microphone is not available, so nothing started/,
    )
    expect(screen.queryByText('Waiting for the microphone…')).toBeNull()
    // Nothing started and nothing was decided for the player.
    expect(begin()).not.toBeNull()
    expect(homeAnswerMode()).toBe('mic')

    fireEvent.click(screen.getByText('Use Tap instead'))
    await waitFor(() => expect(homeAnswerMode()).toBe('tap'))
    expect(screen.queryByText(/nothing started/)).toBeNull()
    // The run begins by tapping: the idle console is gone.
    await waitFor(() => expect(begin()).toBeNull())
    expect(mic.acquire).toHaveBeenCalledTimes(1)
  })

  it('ignores a second Begin while the prompt is still open', async () => {
    let refuse: (reason: Error) => void = () => undefined
    mic.acquire.mockImplementation(
      () =>
        new Promise<MediaStream>((_resolve, reject) => {
          refuse = reject
        }),
    )
    mount()
    const pad = screen.getByRole('button', { name: /Begin/ })
    fireEvent.click(pad)
    fireEvent.click(pad)
    await screen.findByText('Waiting for the microphone…')
    await waitFor(() => expect(mic.acquire).toHaveBeenCalledTimes(1))
    refuse(new DOMException('Permission denied', 'NotAllowedError'))
    await screen.findByText(/nothing started/)
  })
})
