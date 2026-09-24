// Soundscape lifecycle tests — scene changes cannot revive music during capture or after app background.
import { describe, expect, it, vi } from 'vitest'
import { GLASS_FOUNDATION_QUARTER_TURN } from '../content/foundation-routes'
import { GLASSWORKS } from '../content/glassworks'
import { museumSoundscape } from '../content/soundscapes'
import type { LevelDefinition } from '../contracts'
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
    expect(museumSoundscape(GLASSWORKS, position, 'museum')).toBe('museum')
    expect(museumSoundscape(GLASSWORKS, position, 'garden')).toBe('garden')
    expect(museumSoundscape(GLASSWORKS, { x: 5.5, y: 0, z: 2 })).toBe('gallery')
    expect(
      museumSoundscape(
        { ...GLASSWORKS, id: 'future-level' },
        position,
        'garden',
      ),
    ).toBe('museum')
  })

  it('selects compiled translated regions with a modest boundary hysteresis', () => {
    const level: LevelDefinition = {
      ...GLASSWORKS,
      id: 'authored-quarter-turn',
      presentation: {
        worldBounds: {
          minX: 18,
          maxX: 30,
          minY: -2,
          maxY: 4,
          minZ: 8,
          maxZ: 16,
        },
        lightBounds: {
          minX: 18,
          maxX: 30,
          minY: -2,
          maxY: 4,
          minZ: 8,
          maxZ: 16,
        },
        rooms: [],
        audioRegions: [
          {
            id: 'turned-garden',
            bounds: {
              minX: 20,
              maxX: 24,
              minY: -1,
              maxY: 3,
              minZ: 10,
              maxZ: 14,
            },
            sceneId: 'garden',
          },
          {
            id: 'turned-gallery',
            bounds: {
              minX: 24,
              maxX: 28,
              minY: -1,
              maxY: 3,
              minZ: 10,
              maxZ: 14,
            },
            sceneId: 'gallery',
          },
        ],
        visuals: [],
        assetRecipeIds: [],
      },
    }
    expect(museumSoundscape(level, { x: 22, y: 0, z: 12 })).toBe('garden')
    expect(museumSoundscape(level, { x: 24.2, y: 0, z: 12 }, 'garden')).toBe(
      'garden',
    )
    expect(museumSoundscape(level, { x: 24.31, y: 0, z: 12 }, 'garden')).toBe(
      'gallery',
    )
    expect(museumSoundscape(level, { x: 24.31, y: 4, z: 12 }, 'gallery')).toBe(
      'museum',
    )
  })

  it('uses the compiled regions after a room quarter turn', () => {
    const regions = GLASS_FOUNDATION_QUARTER_TURN.presentation!.audioRegions
    expect(new Set(regions.map((region) => region.sceneId))).toEqual(
      new Set(['museum', 'gallery']),
    )
    for (const region of regions) {
      const position = {
        x: (region.bounds.minX + region.bounds.maxX) / 2,
        y: (region.bounds.minY + region.bounds.maxY) / 2,
        z: (region.bounds.minZ + region.bounds.maxZ) / 2,
      }
      expect(museumSoundscape(GLASS_FOUNDATION_QUARTER_TURN, position)).toBe(
        region.sceneId,
      )
    }
  })
})
