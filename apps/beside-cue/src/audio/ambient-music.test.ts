// ============================================================
// Ambient music tests — continuity, quiet home level and lifecycle cleanup
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { V2_ONBOARDING_AUDIO_ASSET_IDS, V2_ONBOARDING_AUDIO_ASSET_MANIFEST, } from '../content/v2-onboarding-audio-manifest'
import { createAmbientMusic } from './ambient-music'
import type { AudioOutputPlayRequest, AudioSessionOutput, } from './audio-session'
import { createAudioSession } from './audio-session'

function fixture() {
  const played: Array<{
    request: AudioOutputPlayRequest
    stop: ReturnType<typeof vi.fn>
    setGain: ReturnType<typeof vi.fn>
  }> = []
  const output: AudioSessionOutput = {
    supportsMimeType: () => true,
    unlock: async () => true,
    dispose: vi.fn(),
    play(request) {
      const handle = {
        request,
        started: Promise.resolve('started' as const),
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
  return { session, music, played }
}

const audible = {
  active: true,
  muted: false,
  foreground: true,
  gain: 0.4,
} as const

describe('ambient music', () => {
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
