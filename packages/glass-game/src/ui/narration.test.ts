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

  it('maps required and optional successes to their approved cues', () => {
    const { audio, subject } = fixture()
    expect(subject.breakCompleted(false)).toEqual({
      cue: 'required-break',
      caption: 'Beautiful. A new path is open.',
    })
    expect(subject.breakCompleted(true)).toEqual({
      cue: 'optional-break',
      caption: 'Gorgeous. Absolutely gorgeous.',
    })
    expect(audio.play).toHaveBeenNthCalledWith(1, 'required-break')
    expect(audio.play).toHaveBeenNthCalledWith(2, 'optional-break')
  })

  it('alternates required path guidance with shuffled reactions', () => {
    const { audio, subject } = fixture()

    expect(subject.breakCompleted(false).cue).toBe('required-break')
    expect(subject.breakCompleted(false).cue).toBe('optional-break')
    expect(subject.breakCompleted(false).cue).toBe('required-break')

    expect(audio.play).toHaveBeenNthCalledWith(1, 'required-break')
    expect(audio.play).toHaveBeenNthCalledWith(2, 'optional-break')
    expect(audio.play).toHaveBeenNthCalledWith(3, 'required-break')
  })

  it('still returns the selected caption while narration is disabled', () => {
    const { audio, subject } = fixture(false)

    expect(subject.breakCompleted(false)).toEqual({
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
    subject.breakCompleted(false)
    await quiet
    expect(audio.play).not.toHaveBeenCalled()

    subject.releaseVoice()
    expect(audio.play).not.toHaveBeenCalled()
    subject.breakCompleted(false)
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('optional-break')
  })

  it('consumes a pending welcome before capture so it cannot replace the success cue', async () => {
    const { audio, subject } = fixture()
    const stale = deferred()
    vi.mocked(audio.play).mockReturnValueOnce(stale.promise)
    subject.welcomeGesture()
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('tutorial-note')

    await subject.silenceForVoice()
    subject.releaseVoice()
    subject.breakCompleted(false)
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
    subject.breakCompleted(false)
    allow(false)
    subject.pause()
    allow(true)
    expect(audio.play).toHaveBeenCalledTimes(1)
    subject.breakCompleted(true)
    expect(audio.play).toHaveBeenCalledTimes(2)

    subject.dispose()
    subject.dispose()
    subject.breakCompleted(false)
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
