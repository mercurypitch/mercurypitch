// Voice capture ownership — real microphone-manager teardown must retire a listening session.
import type * as PitchEngine from '@irchiinnuss/pitch-engine'
import { micManager } from '@irchiinnuss/pitch-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserVoice } from './voice-session'

const edge = vi.hoisted(() => ({ audio: vi.fn(), capture: vi.fn() }))
vi.mock('@irchiinnuss/audio-io', () => ({
  acquireSharedAudioContext: edge.audio,
}))
vi.mock('@irchiinnuss/pitch-engine', async (original) => ({
  ...(await original<typeof PitchEngine>()),
  createF0Stream: edge.capture,
}))

let track: EventTarget & { muted: boolean; readyState: string; stop(): void }
let dispose: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  const context = Object.assign(new EventTarget(), {
    state: 'running',
    currentTime: 10,
  })
  edge.audio.mockImplementation(() => ({
    ensure: () => context,
    peek: () => context,
    unlock: vi.fn().mockResolvedValue(true),
    release: vi.fn(),
  }))
  track = Object.assign(new EventTarget(), {
    muted: false,
    readyState: 'live',
    getSettings: () => ({}),
    // MediaStreamTrack.stop() changes readyState without dispatching ended.
    stop() {
      this.readyState = 'ended'
    },
  })
  getUserMedia = vi.fn(async () => ({
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }))
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  dispose = vi.fn()
  edge.capture.mockImplementation(() => ({
    startTask: vi.fn(),
    dispose,
    latestCaptured: () => null,
    subscribeCaptured: () => () => undefined,
  }))
})

afterEach(async () => {
  await micManager.forceReleaseAll()
  await micManager.setPreferredDevice(null)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('external shared microphone teardown', () => {
  it('keeps lifecycle diagnostics off without the portable-console build flag', async () => {
    vi.stubEnv('VITE_PORTABLE_CONSOLE', '')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const voice = createBrowserVoice()
    await voice.start()
    voice.stop()
    expect(info).not.toHaveBeenCalled()
  })

  it('opens a fresh session after the manager retired the previous capture', async () => {
    const previous = createBrowserVoice()
    await previous.start()
    const previousStopped = vi.fn()
    previous.subscribe(vi.fn(), previousStopped)
    await micManager.forceReleaseAll()
    const freshTrack = Object.assign(new EventTarget(), {
      muted: false,
      readyState: 'live',
      getSettings: () => ({}),
      stop() {
        this.readyState = 'ended'
      },
    })
    getUserMedia.mockResolvedValueOnce({
      getTracks: () => [freshTrack],
      getAudioTracks: () => [freshTrack],
    })
    const fresh = createBrowserVoice()
    await fresh.start()
    const freshStopped = vi.fn()
    fresh.subscribe(vi.fn(), freshStopped)
    previous.stop()
    expect(previousStopped).toHaveBeenCalledOnce()
    expect(freshStopped).not.toHaveBeenCalled()
    expect(freshTrack.readyState).toBe('live')
    expect(fresh.inputSettings?.()).not.toBeNull()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    fresh.stop()
  })

  it.each(['force-release', 'route-change'] as const)(
    'reports %s once even though stopping the track emits no event',
    async (action) => {
      const voice = createBrowserVoice()
      await voice.start()
      const interrupted = vi.fn()
      voice.subscribe(vi.fn(), interrupted)
      if (action === 'force-release') await micManager.forceReleaseAll()
      else await micManager.setPreferredDevice('another-route')
      expect(track.readyState).toBe('ended')
      expect(interrupted).toHaveBeenCalledOnce()
      expect(dispose).toHaveBeenCalledOnce()
      expect(voice.inputSettings?.()).toBeNull()
      expect(getUserMedia).toHaveBeenCalledOnce()
      await expect(voice.start()).rejects.toThrow('ended')
    },
  )

  it('keeps the voice listening when another consumer leaves the same live stream', async () => {
    const voice = createBrowserVoice()
    await voice.start()
    const interrupted = vi.fn()
    voice.subscribe(vi.fn(), interrupted)
    await micManager.acquire('other-consumer')
    micManager.release('other-consumer')
    await micManager.setPreferredDevice(null)
    expect(track.readyState).toBe('live')
    expect(interrupted).not.toHaveBeenCalled()
    expect(dispose).not.toHaveBeenCalled()
    voice.stop()
    await micManager.forceReleaseAll()
    expect(interrupted).not.toHaveBeenCalled()
  })
})
