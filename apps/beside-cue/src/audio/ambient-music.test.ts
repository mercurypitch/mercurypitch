// ============================================================
// Ambient music tests — continuity, quiet home level and lifecycle cleanup
// ============================================================

import { batch, createEffect, createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { V2_ONBOARDING_AUDIO_ASSET_IDS, V2_ONBOARDING_AUDIO_ASSET_MANIFEST, } from '../content/v2-onboarding-audio-manifest'
import { createAmbientMusic } from './ambient-music'
import type { AudioOutputPlayRequest, AudioSessionOutput, } from './audio-session'
import { createAudioSession } from './audio-session'

function fixture(
  start: (attempt: number) => Promise<'started' | 'failed'> = () =>
    Promise.resolve('started'),
) {
  const played: Array<{
    request: AudioOutputPlayRequest
    stop: ReturnType<typeof vi.fn>
    setGain: ReturnType<typeof vi.fn>
  }> = []
  const unlock = vi.fn(async () => true)
  const output: AudioSessionOutput = {
    supportsMimeType: () => true,
    unlock,
    dispose: vi.fn(),
    play(request) {
      const handle = {
        request,
        started: start(played.length),
        finished: new Promise<'ended'>(() => undefined),
        stop: vi.fn(),
        setGain: vi.fn(),
      }
      played.push(handle)
      return handle
    },
  }
  const session = createAudioSession({
    manifest: V2_ONBOARDING_AUDIO_ASSET_MANIFEST,
    output,
  })
  const music = createAmbientMusic(session, V2_ONBOARDING_AUDIO_ASSET_IDS.score)
  return { session, music, played, unlock }
}

const audible = {
  active: true,
  muted: false,
  foreground: true,
  gain: 0.4,
} as const

describe('ambient music', () => {
  it('preserves the unmute gesture before the Solid effect refreshes ambient state', async () => {
    const { session, music, played, unlock } = fixture()
    session.setMuted(true)
    let setMuted!: (muted: boolean) => void
    const disposeRoot = createRoot((dispose) => {
      const [muted, updateMuted] = createSignal(true)
      setMuted = updateMuted
      createEffect(() => music.update({ ...audible, muted: muted() }))
      return dispose
    })
    expect(played).toHaveLength(0)

    let synchronousUnlockCalls = 0
    batch(() => {
      // App updates the session immediately; its ambient createEffect waits
      // until this event batch ends. Permission must not wait for that effect.
      session.setMuted(false)
      setMuted(false)
      music.unlock()
      synchronousUnlockCalls = unlock.mock.calls.length
      expect(played).toHaveLength(0)
    })

    await Promise.resolve()
    expect(synchronousUnlockCalls).toBe(1)
    expect(played).toHaveLength(1)
    disposeRoot()
    music.dispose()
  })

  it('keeps muted sessions silent when permission is requested before a state refresh', async () => {
    const { session, music, played, unlock } = fixture()
    session.setMuted(true)
    music.update({ ...audible, muted: true })
    music.unlock()
    await Promise.resolve()
    await Promise.resolve()
    expect(unlock).not.toHaveBeenCalled()
    expect(played).toHaveLength(0)
    music.dispose()
  })

  it('handles a rejected permission attempt without starting music or leaking a rejection', async () => {
    const { session, music, played } = fixture()
    const unlock = vi
      .spyOn(session, 'unlock')
      .mockRejectedValueOnce(new Error('Permission unavailable'))
    music.update({ ...audible, muted: true })
    music.unlock()
    await Promise.resolve()
    await Promise.resolve()
    expect(unlock).toHaveBeenCalledOnce()
    expect(played).toHaveLength(0)
    music.dispose()
  })

  it('retries a pre-gesture failure that settles after the successful begin unlock', async () => {
    let failFirst!: (result: 'failed') => void
    const firstStart = new Promise<'failed'>((resolve) => {
      failFirst = resolve
    })
    const { music, played } = fixture((attempt) =>
      attempt === 0 ? firstStart : Promise.resolve('started'),
    )
    music.update(audible)
    expect(played).toHaveLength(1)

    // iOS can reject an earlier non-gesture resume only after the begin tap
    // has successfully unlocked the clock. The pending cue is not proof of sound.
    music.unlock()
    await Promise.resolve()
    await Promise.resolve()
    failFirst('failed')

    await vi.waitFor(() => expect(played).toHaveLength(2))
    music.update({ ...audible, gain: 0.16 })
    expect(played[1]?.stop).not.toHaveBeenCalled()
    expect(played[1]?.setGain).toHaveBeenLastCalledWith(0.16)
    music.dispose()
  })

  it('does not automatically retry a failed load without a new successful gesture', async () => {
    const { music, played } = fixture(() => Promise.resolve('failed'))
    music.update(audible)
    await Promise.resolve()
    await Promise.resolve()
    expect(played).toHaveLength(1)

    music.unlock()
    await vi.waitFor(() => expect(played).toHaveLength(2))
    await Promise.resolve()
    await Promise.resolve()
    expect(played).toHaveLength(2)
    music.dispose()
  })

  it('uses the whole looping composition and keeps its source through overlays and home', async () => {
    const { music, played } = fixture()
    music.update(audible)
    await Promise.resolve()
    for (let overlay = 0; overlay < 8; overlay += 1) music.update(audible)
    music.update({ ...audible, gain: 0.16 })

    expect(played).toHaveLength(1)
    expect(played[0]?.request.playback).toEqual({
      kind: 'loop',
      loopStartMs: 1_500,
      loopEndMs: 77_880,
    })
    expect(played[0]?.request.source.durationMs).toBe(77_880)
    expect(played[0]?.request.initialGain).toBe(0.4)
    expect(played[0]?.stop).not.toHaveBeenCalled()
    expect(played[0]?.setGain).toHaveBeenLastCalledWith(0.16)
    music.dispose()
  })

  it('keeps dialogue ducking relative to the home mix level', async () => {
    const { session, music, played } = fixture()
    music.update({ ...audible, gain: 0.16 })
    await Promise.resolve()
    const voice = session.createScope('voice')
    voice.play(V2_ONBOARDING_AUDIO_ASSET_IDS.greeting)
    await Promise.resolve()
    expect(played[0]?.setGain).toHaveBeenLastCalledWith(0.16 * 0.35)
    voice.stopAll()
    expect(played[0]?.setGain).toHaveBeenLastCalledWith(0.16)
    music.dispose()
  })

  it('cancels sound when muted, backgrounded or leaving home and resumes only when eligible', async () => {
    const { session, music, played } = fixture()
    music.update(audible)
    await Promise.resolve()
    session.setMuted(true)
    music.update({ ...audible, muted: true })
    expect(played[0]?.stop).toHaveBeenCalledOnce()
    session.setMuted(false)
    music.update(audible)
    await Promise.resolve()
    expect(played).toHaveLength(2)
    session.setForeground(false)
    music.update({ ...audible, foreground: false })
    expect(played[1]?.stop).toHaveBeenCalledOnce()
    music.unlock()
    expect(played).toHaveLength(2)
    session.setForeground(true)
    music.update(audible)
    await Promise.resolve()
    music.update({ ...audible, active: false })
    expect(played[2]?.stop).toHaveBeenCalledOnce()
    music.dispose()
    music.update(audible)
    expect(played).toHaveLength(3)
  })
})
