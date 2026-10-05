// Merc narration lifecycle tests — stale cues never cross capture, pause or preference boundaries.
import { describe, expect, it, vi } from 'vitest'
import type { GlassMercNarration, MercNarrationCue } from '../host'
import { createAdventureNarration } from './narration'

function deferred() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

function fixture(initiallyEnabled = true, random: () => number = () => 0) {
  let allowed = true
  let enabled = initiallyEnabled
  const audio: GlassMercNarration = {
    play: vi.fn((_cue: MercNarrationCue) => Promise.resolve(true)),
    silenceForVoice: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    preferences: () => ({ enabled }),
    setPreferences: vi.fn((patch) => {
      enabled = patch.enabled ?? enabled
    }),
    dispose: vi.fn(),
  }
  const subject = createAdventureNarration(audio, () => allowed, random)
  return {
    audio,
    subject,
    allow(value: boolean) {
      allowed = value
    },
  }
}

describe('adventure narration', () => {
  it('passes speech energy only while the visible game owns narration', async () => {
    const { audio, subject, allow } = fixture()
    audio.outputLevel = () => 0.6
    expect(subject.outputLevel()).toBe(0.6)
    allow(false)
    expect(subject.outputLevel()).toBe(0)
    allow(true)
    await subject.silenceForVoice()
    expect(subject.outputLevel()).toBe(0)
    subject.releaseVoice()
    expect(subject.outputLevel()).toBe(0.6)
    subject.dispose()
    expect(subject.outputLevel()).toBe(0)
    expect(createAdventureNarration(undefined, () => true).outputLevel()).toBe(
      0,
    )
  })

  it('preserves an unattempted welcome while the initial scene is loading', async () => {
    const { audio, subject, allow } = fixture()
    allow(false)
    subject.pause()
    subject.welcomeGesture()
    expect(audio.play).not.toHaveBeenCalled()

    allow(true)
    subject.welcomeGesture()
    await Promise.resolve()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('tutorial-note')
  })

  it('plays the welcome once and coalesces gestures while startup is pending', async () => {
    const { audio, subject, allow } = fixture()
    allow(false)
    subject.welcomeGesture()
    expect(audio.play).not.toHaveBeenCalled()

    allow(true)
    const pending = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(pending.promise)
    subject.welcomeGesture()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('tutorial-note')

    pending.resolve(true)
    await pending.promise
    subject.pause()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('retries a welcome that failed to start on the next real gesture', async () => {
    const { audio, subject } = fixture()
    vi.mocked(audio.play)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    subject.welcomeGesture()
    await Promise.resolve()
    subject.welcomeGesture()
    await Promise.resolve()
    subject.welcomeGesture()

    expect(audio.play).toHaveBeenNthCalledWith(1, 'tutorial-note')
    expect(audio.play).toHaveBeenNthCalledWith(2, 'tutorial-note')
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('retries an unstarted welcome on a later gesture after capture is cancelled', async () => {
    const { audio, subject } = fixture()
    const pending = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(pending.promise)
    subject.welcomeGesture()
    await subject.silenceForVoice()
    pending.resolve(false)
    await pending.promise
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledTimes(1)

    // The visit pauses narration before cancelling the capture session.
    subject.pause()
    subject.releaseVoice()
    expect(audio.play).toHaveBeenCalledTimes(1)
    subject.welcomeGesture()
    await Promise.resolve()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledTimes(2)
    expect(audio.play).toHaveBeenLastCalledWith('tutorial-note')
  })

  it('keeps an already started welcome consumed after capture is cancelled', async () => {
    const { audio, subject } = fixture()
    subject.welcomeGesture()
    await Promise.resolve()
    await subject.silenceForVoice()
    subject.pause()
    subject.releaseVoice()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('tutorial-note')
  })

  it('lets a break reaction retire the unplayed welcome even if that reaction cannot start', async () => {
    const { audio, subject } = fixture()
    await subject.silenceForVoice()
    subject.releaseVoice()
    vi.mocked(audio.play).mockResolvedValueOnce(false)
    subject.breakCompleted('path-opened')
    await Promise.resolve()
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('required-break')
  })

  it('maps real access outcomes and neutral celebrations to approved cues', () => {
    const { audio, subject } = fixture()
    expect(subject.breakCompleted('path-opened')).toEqual({
      cue: 'required-break',
      caption: 'Beautiful. A new path is open.',
    })
    expect(subject.breakCompleted('exit-opened')).toEqual({
      cue: 'required-break',
      caption: 'Beautiful. A new path is open.',
    })
    expect(subject.breakCompleted('celebration')).toEqual({
      cue: 'optional-break',
      caption: 'Gorgeous. Absolutely gorgeous.',
    })
    expect(audio.play).toHaveBeenNthCalledWith(1, 'required-break')
    expect(audio.play).toHaveBeenNthCalledWith(2, 'required-break')
    expect(audio.play).toHaveBeenNthCalledWith(3, 'optional-break')
  })

  it('keeps repeated celebrations neutral, including Encore', () => {
    const { audio, subject } = fixture()

    expect(subject.breakCompleted('celebration').cue).toBe('optional-break')
    expect(subject.breakCompleted('celebration').cue).toBe(
      'cracking-performance',
    )
    expect(subject.breakCompleted('celebration').cue).toBe('music-to-my-ears')

    expect(audio.play).not.toHaveBeenCalledWith('required-break')
  })

  it('still returns the selected caption while narration is disabled', () => {
    const { audio, subject } = fixture(false)

    expect(subject.breakCompleted('path-opened')).toEqual({
      cue: 'required-break',
      caption: 'Beautiful. A new path is open.',
    })
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('invalidates narration synchronously and holds every cue through capture', async () => {
    const { audio, subject } = fixture()
    const quiet = subject.silenceForVoice()
    expect(audio.silenceForVoice).toHaveBeenCalledOnce()

    subject.welcomeGesture()
    subject.breakCompleted('path-opened')
    await quiet
    expect(audio.play).not.toHaveBeenCalled()

    subject.releaseVoice()
    expect(audio.play).not.toHaveBeenCalled()
    subject.breakCompleted('celebration')
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('optional-break')
  })

  it('retires a cancelled welcome when success supplies the next cue', async () => {
    const { audio, subject } = fixture()
    const stale = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(stale.promise)
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('tutorial-note')

    await subject.silenceForVoice()
    subject.releaseVoice()
    subject.breakCompleted('path-opened')
    stale.resolve(false)
    await stale.promise
    subject.welcomeGesture()

    expect(audio.play).toHaveBeenCalledTimes(2)
    expect(audio.play).toHaveBeenLastCalledWith('required-break')
  })

  it('consumes a pending welcome when disabled and never autoplays after re-enable', async () => {
    const { audio, subject } = fixture()
    const pending = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(pending.promise)
    subject.welcomeGesture()
    subject.setEnabled(false)
    expect(audio.setPreferences).toHaveBeenLastCalledWith({ enabled: false })
    expect(audio.pause).toHaveBeenCalledOnce()
    expect(subject.preferences()).toEqual({ enabled: false })

    pending.resolve(false)
    await pending.promise
    subject.setEnabled(true)
    expect(audio.setPreferences).toHaveBeenLastCalledWith({ enabled: true })
    expect(audio.play).toHaveBeenCalledTimes(1)
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('keeps a persisted opt-out consumed after it is re-enabled', () => {
    const { audio, subject } = fixture(false)
    subject.welcomeGesture()
    subject.setEnabled(true)
    subject.welcomeGesture()
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('consumes an in-flight welcome across Pause or tutorial', async () => {
    const { audio, subject } = fixture()
    const stale = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(stale.promise)
    subject.welcomeGesture()
    subject.pause()

    stale.resolve(false)
    await stale.promise
    subject.welcomeGesture()

    expect(audio.pause).toHaveBeenCalledOnce()
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('retires an in-flight welcome permanently on disposal', async () => {
    const { audio, subject } = fixture()
    const stale = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(stale.promise)
    subject.welcomeGesture()
    subject.dispose()
    stale.resolve(false)
    await stale.promise
    subject.welcomeGesture()

    expect(audio.dispose).toHaveBeenCalledOnce()
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('pauses without queuing a replay and disposes once', () => {
    const { audio, subject, allow } = fixture()
    subject.breakCompleted('path-opened')
    allow(false)
    subject.pause()
    allow(true)
    expect(audio.play).toHaveBeenCalledTimes(1)
    subject.breakCompleted('celebration')
    expect(audio.play).toHaveBeenCalledTimes(2)

    subject.dispose()
    subject.dispose()
    subject.breakCompleted('path-opened')
    subject.welcomeGesture()
    subject.setEnabled(false)
    void subject.silenceForVoice()

    expect(audio.pause).toHaveBeenCalledOnce()
    expect(audio.dispose).toHaveBeenCalledOnce()
    expect(audio.setPreferences).not.toHaveBeenCalled()
    expect(audio.silenceForVoice).not.toHaveBeenCalled()
    expect(audio.play).toHaveBeenCalledTimes(2)
  })
})
