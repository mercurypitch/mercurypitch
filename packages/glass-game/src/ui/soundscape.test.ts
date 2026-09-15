// Soundscape lifecycle tests — scene changes cannot revive music during capture or after app background.
import { describe, expect, it, vi } from 'vitest'
import { museumSoundscape } from '../content/soundscapes'
import type { GlassMuseumAudio, MuseumAudioScene } from '../host'
import { createAdventureSoundscape } from './soundscape'

function fixture() {
  let allowed = true
  let scene: MuseumAudioScene = 'museum'
  const audio: GlassMuseumAudio = {
    start: vi.fn().mockResolvedValue(true),
    silenceForVoice: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    preferences: () => ({
      muted: false,
      musicVolume: 0.6,
      ambienceVolume: 0.5,
    }),
    setPreferences: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    audio,
    subject: createAdventureSoundscape(
      audio,
      () => scene,
      () => allowed,
    ),
    scene: (value: MuseumAudioScene) => {
      scene = value
    },
    allow: (value: boolean) => {
      allowed = value
    },
  }
}

describe('adventure soundscape', () => {
  it('waits for a gesture and coalesces frames before crossfading a new region', () => {
    const { subject, audio, scene } = fixture()
    subject.update()
    expect(audio.start).not.toHaveBeenCalled()
    subject.activate()
    for (let frame = 0; frame < 100; frame++) subject.update()
    expect(audio.start).toHaveBeenCalledExactlyOnceWith('museum')
    scene('garden')
    subject.update()
    expect(audio.start).toHaveBeenLastCalledWith('garden')
    expect(audio.start).toHaveBeenCalledTimes(2)
  })

  it('holds silence through movement gestures and area changes until capture is released', async () => {
    const { subject, audio, scene } = fixture()
    subject.activate()
    await subject.silenceForVoice()
    scene('garden')
    subject.activate()
    subject.update()
    expect(audio.start).toHaveBeenCalledTimes(1)
    subject.releaseVoice()
    expect(audio.start).toHaveBeenLastCalledWith('garden')
  })

  it('never resumes when background cancellation releases capture or frames resume', async () => {
    const { subject, audio, allow } = fixture()
    subject.activate()
    await subject.silenceForVoice()
    subject.pause()
    subject.releaseVoice()
    allow(false)
    subject.activate()
    allow(true)
    subject.update()
    expect(audio.start).toHaveBeenCalledTimes(1)
    subject.activate()
    expect(audio.start).toHaveBeenCalledTimes(2)
  })

  it('requires a new gesture after failure instead of retrying every render frame', async () => {
    const { subject, audio } = fixture()
    vi.mocked(audio.start).mockResolvedValueOnce(false)
    subject.activate()
    await Promise.resolve()
    subject.update()
    expect(audio.start).toHaveBeenCalledTimes(1)
    subject.activate()
    expect(audio.start).toHaveBeenCalledTimes(2)
    subject.dispose()
    subject.activate()
    subject.update()
    expect(audio.start).toHaveBeenCalledTimes(2)
    expect(audio.dispose).toHaveBeenCalledOnce()
  })

  it('lets a fresh gesture recover an output interrupted after a successful start', async () => {
    const { subject, audio } = fixture()
    subject.activate()
    await Promise.resolve()
    // The service may lose an output independently of the game UI (headphones
    // or a foreground audio-route change). Rendering must not auto-resume it.
    subject.update()
    expect(audio.start).toHaveBeenCalledTimes(1)
    subject.activate()
    expect(audio.start).toHaveBeenCalledTimes(2)
  })

  it('uses overlapping region boundaries so small movements do not repeatedly change music', () => {
    const position = { x: 8, y: 0, z: 5 }
    expect(museumSoundscape('glassworks', position, 'museum')).toBe('museum')
    expect(museumSoundscape('glassworks', position, 'garden')).toBe('garden')
    expect(museumSoundscape('glassworks', { x: 5.5, y: 0, z: 2 })).toBe(
      'gallery',
    )
    expect(museumSoundscape('future-level', position, 'garden')).toBe('museum')
  })
})
