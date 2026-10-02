// Runner mix session tests — optional preparation, stale cancellation and live levels leave capture and course timing intact.
import { describe, expect, it, vi } from 'vitest'
import { deferred, flush, runnerSessionHarness, } from './__fixtures__/runner-session'

describe('runner session audio mix', () => {
  it('finishes backing preparation before readiness can anchor a fresh count-in', async () => {
    const h = runnerSessionHarness()
    const decoded = deferred<{ music: boolean; ambience: boolean }>()
    h.session.setPresentationReady(true)
    const starting = h.session.start()
    vi.mocked(h.audio[0]!.prepareBacking).mockReturnValue(decoded.promise)
    await flush()
    h.setAudioTime(100)

    expect(h.session.state().phase).toBe('preparing')
    expect(h.voices[0]!.detectorReady).toBe(false)
    expect(h.audio[0]!.schedule).not.toHaveBeenCalled()
    decoded.resolve({ music: true, ambience: false })
    await starting
    h.ready()

    expect(h.session.state()).toMatchObject({
      phase: 'count-in',
      backing: { music: true, ambience: false },
    })
    expect(h.audio[0]!.anchor!.countInStartAudioSeconds).toBeGreaterThan(100)
    h.session.dispose()
  })

  it('keeps the microphone and examples usable when both optional recordings fail', async () => {
    const h = runnerSessionHarness()
    const starting = h.session.start()
    vi.mocked(h.audio[0]!.prepareBacking).mockResolvedValue({
      music: false,
      ambience: false,
    })

    await starting

    expect(h.session.state()).toMatchObject({
      phase: 'readiness',
      microphone: 'ready',
      backing: { music: false, ambience: false },
      error: null,
      audioPreferences: { guideVolume: 0.65 },
    })
    expect(h.voices[0]!.detectorReady).toBe(true)
    h.session.dispose()
  })

  it('discards a backing result that arrives after Pause without restarting readiness', async () => {
    const h = runnerSessionHarness()
    const decoded = deferred<{ music: boolean; ambience: boolean }>()
    const starting = h.session.start()
    vi.mocked(h.audio[0]!.prepareBacking).mockReturnValue(decoded.promise)
    await flush()

    h.session.pause()
    decoded.resolve({ music: true, ambience: true })
    await starting

    expect(h.session.state()).toMatchObject({
      phase: 'paused',
      microphone: 'closed',
      backing: null,
    })
    expect(h.audio[0]!.schedule).not.toHaveBeenCalled()
    expect(h.frames.size).toBe(0)
    expect(h.voices[0]!.detectorReady).toBe(false)
    h.session.dispose()
  })

  it('saves clamped music/example levels during a run without pausing capture or reloading assets', async () => {
    const h = runnerSessionHarness()
    await h.running()

    h.session.setAudioPreferences({ musicVolume: 0, guideVolume: 3 })
    h.courseTick(0.2)

    expect(h.session.state()).toMatchObject({
      phase: 'running',
      musicMuted: false,
      audioPreferences: { musicMuted: false, musicVolume: 0, guideVolume: 1 },
    })
    expect(h.audio[0]!.setPreferences).toHaveBeenLastCalledWith({
      musicMuted: false,
      musicVolume: 0,
      guideVolume: 1,
    })
    expect(h.audio[0]!.prepareBacking).toHaveBeenCalledOnce()
    expect(h.voices[0]!.stop).not.toHaveBeenCalled()
    expect(JSON.parse(h.preferences.get('runner-audio:v1')!)).toEqual({
      musicMuted: false,
      musicVolume: 0,
      guideVolume: 1,
    })
    h.session.dispose()
  })

  it('ducks any credible voice outside scoring and releases the extra dip after stale input', async () => {
    const h = runnerSessionHarness()
    await h.running()
    const anchor = h.audio[0]!.anchor!

    h.emit(anchor.audioStartSeconds + 0.02, 66)
    expect(h.audio[0]!.setVoiceActive).toHaveBeenLastCalledWith(true)
    h.courseTick(0.16)

    expect(h.audio[0]!.setVoiceActive).toHaveBeenLastCalledWith(false)
    expect(h.session.state().game.resolvedTargets).toEqual([])
    h.session.dispose()
  })
})
