// Runner reference regression — setup context, bounded playback and cancellation through the output tail.
import { describe, expect, it, vi } from 'vitest'
import { deferred, flush, runnerSessionHarness, } from './__fixtures__/runner-session'

describe('runner reference playback', () => {
  it.each(['idle', 'paused', 'error'] as const)(
    'keeps the %s setup context and closed capture throughout playback',
    async (phase) => {
      const h = runnerSessionHarness()
      if (phase === 'paused') {
        await h.running()
        h.courseTick(0.2)
        h.session.pause('microphone-interrupted')
      } else if (phase === 'error') {
        h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
        await h.session.start()
      }
      const before = h.session.state()
      const voices = h.voices.length
      const phases: string[] = []
      h.session.subscribe(({ state }) => phases.push(state.phase))

      const reference = h.session.hearReference()
      expect(h.session.state().referencePlayback.phase).toBe('preparing')
      await flush()

      expect(h.session.state()).toMatchObject({
        phase,
        microphone: 'closed',
        pauseReason: before.pauseReason,
        referencePlayback: { phase: 'playing', error: null },
      })
      expect(h.session.state().error).toBe(before.error)
      expect(h.session.state().game).toEqual(before.game)
      expect(h.voices).toHaveLength(voices)
      h.audio.at(-1)!.endReference()
      await reference
      expect(h.session.state().referencePlayback).toEqual({
        phase: 'idle',
        error: null,
      })
      expect(h.session.state().error).toBe(before.error)
      expect(phases.every((value) => value === phase)).toBe(true)
      expect(h.audio.at(-1)!.dispose).toHaveBeenCalledOnce()
      h.session.dispose()
    },
  )

  it('coalesces repeat requests until the example and its release tail have closed', async () => {
    const h = runnerSessionHarness()
    h.holdAudioRelease()

    const first = h.session.hearReference()
    expect(h.session.hearReference()).toBe(first)
    await flush()
    for (let tap = 0; tap < 4; tap++)
      expect(h.session.hearReference()).toBe(first)
    h.audio[0]!.endReference()
    await flush()

    expect(h.session.state().referencePlayback.phase).toBe('playing')
    expect(h.session.hearReference()).toBe(first)
    expect(h.audio).toHaveLength(1)
    expect(h.audio[0]!.hearReference).toHaveBeenCalledExactlyOnceWith(60)
    expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
    expect(h.voices).toHaveLength(0)
    h.audio[0]!.release()
    await first
    expect(h.session.state().referencePlayback.phase).toBe('idle')
    h.session.dispose()
  })

  it.each(['construction', 'unlock', 'playback'] as const)(
    'keeps a %s failure local to the reference and leaves microphone recovery intact',
    async (failure) => {
      const h = runnerSessionHarness()
      h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
      await h.session.start()
      const before = h.session.state()
      const createAudio = vi
        .mocked(h.host.createRunnerAudio)
        .getMockImplementation()!
      vi.mocked(h.host.createRunnerAudio).mockImplementation((...args) => {
        if (failure === 'construction') throw new Error('No audio')
        const next = createAudio(...args)
        if (failure === 'unlock')
          vi.mocked(next.unlock).mockResolvedValue(false)
        if (failure === 'playback')
          vi.mocked(next.hearReference).mockRejectedValue(new Error('No note'))
        return next
      })

      await h.session.hearReference()

      expect(h.session.state().phase).toBe('error')
      expect(h.session.state().error).toBe(before.error)
      expect(h.session.state().error?.microphoneIssue?.action).toBe('take-over')
      expect(h.session.state().referencePlayback).toEqual({
        phase: 'idle',
        error: 'The note could not play. Tap Hear note to try again.',
      })
      expect(h.voices).toHaveLength(1)
      vi.mocked(h.host.createRunnerAudio).mockImplementation(createAudio)
      const retry = h.session.hearReference()
      await flush()
      expect(h.session.state().referencePlayback).toEqual({
        phase: 'playing',
        error: null,
      })
      h.audio.at(-1)!.endReference()
      await retry
      expect(h.session.state().error).toBe(before.error)
      h.session.dispose()
    },
  )

  it.each(['pause', 'background', 'presentation', 'dispose'] as const)(
    'settles an unfinished unlock after %s and rejects its late completion',
    async (cancellation) => {
      const h = runnerSessionHarness()
      h.session.setPresentationReady(true)
      const unlock = deferred<boolean>()
      const createAudio = vi
        .mocked(h.host.createRunnerAudio)
        .getMockImplementation()!
      vi.mocked(h.host.createRunnerAudio).mockImplementation((...args) => {
        const next = createAudio(...args)
        vi.mocked(next.unlock).mockReturnValue(unlock.promise)
        return next
      })
      const reference = h.session.hearReference()
      expect(h.session.state().referencePlayback.phase).toBe('preparing')

      if (cancellation === 'pause') h.session.pause()
      if (cancellation === 'background') h.foreground(false)
      if (cancellation === 'presentation') h.session.setPresentationReady(false)
      if (cancellation === 'dispose') h.session.dispose()
      await reference

      const after = h.session.state()
      expect(after.phase).toBe(cancellation === 'dispose' ? 'disposed' : 'idle')
      expect(after.referencePlayback).toEqual({ phase: 'idle', error: null })
      expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
      expect(h.audio[0]!.hearReference).not.toHaveBeenCalled()
      expect(h.voices).toHaveLength(0)
      unlock.resolve(true)
      await flush()
      expect(h.session.state()).toBe(after)
      h.session.dispose()
    },
  )

  it.each(['preparing', 'playing'] as const)(
    'honors synchronous %s cancellation before playing a reference',
    async (phase) => {
      const h = runnerSessionHarness()
      h.session.subscribe(({ state }) => {
        if (state.referencePlayback.phase === phase) h.session.pause()
      })

      await h.session.hearReference()

      expect(h.session.state().referencePlayback.phase).toBe('idle')
      expect(h.audio).toHaveLength(phase === 'preparing' ? 0 : 1)
      if (phase === 'playing') {
        expect(h.audio[0]!.hearReference).not.toHaveBeenCalled()
        expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
      }
      expect(h.voices).toHaveLength(0)
      h.session.dispose()
    },
  )

  it('waits for a retired reference tail before playing a newer example', async () => {
    const h = runnerSessionHarness()
    h.holdAudioRelease()
    const first = h.session.hearReference()
    await flush()
    h.session.pause()

    const second = h.session.hearReference()
    await flush()

    expect(h.session.state().referencePlayback.phase).toBe('preparing')
    expect(h.audio[1]!.hearReference).not.toHaveBeenCalled()
    h.audio[0]!.release()
    await first
    await flush()
    expect(h.session.state().referencePlayback.phase).toBe('playing')
    expect(h.audio[1]!.hearReference).toHaveBeenCalledExactlyOnceWith(60)
    h.session.dispose()
    h.audio[1]!.release()
    await second
    expect(h.session.state().phase).toBe('disposed')
    expect(
      h.audio.every((next) => vi.mocked(next.dispose).mock.calls.length === 1),
    ).toBe(true)
  })

  it('reports an interrupted reference without replacing the existing setup error', async () => {
    const h = runnerSessionHarness()
    h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
    await h.session.start()
    const before = h.session.state()
    const reference = h.session.hearReference()
    await flush()

    h.audio.at(-1)!.interrupt()
    await reference

    expect(h.session.state().phase).toBe('error')
    expect(h.session.state().error).toBe(before.error)
    expect(h.session.state().referencePlayback).toEqual({
      phase: 'idle',
      error: 'Note playback was interrupted. Tap Hear note to try again.',
    })
    expect(h.audio.at(-1)!.dispose).toHaveBeenCalledOnce()
    h.session.dispose()
  })
})
