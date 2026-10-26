// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { integratedLoudness } from '@/lib/studio-fx/loudness'
import { sampledAudio, toneAudio } from './audio.fixture'
import { measurePreparationLoudness, sourcePreparation, } from './preparation-gain'

describe('bounded Studio preparation', () => {
  it.each([
    [2400, 1],
    [19200, 2],
    [96000, 1],
    [144000, 2],
  ])(
    'matches whole-buffer BS.1770 at %i frames and %i channels',
    async (frames, channels) => {
      const audio = toneAudio(frames, channels)
      expect(await measurePreparationLoudness(audio)).toBeCloseTo(
        integratedLoudness(audio),
        8,
      )
    },
  )

  it('matches relative and absolute gating across loud, quiet and silent material', async () => {
    const audio = toneAudio(192000, 2)
    for (let channel = 0; channel < 2; channel++) {
      const samples = audio.getChannelData(channel)
      samples.fill(0, 0, 48000)
      for (let frame = 96000; frame < 144000; frame++) samples[frame] *= 0.001
    }
    expect(await measurePreparationLoudness(audio)).toBeCloseTo(
      integratedLoudness(audio),
      7,
    )
  })

  it('keeps silence finite and clamps preparation without changing samples', async () => {
    expect(
      (await sourcePreparation(sampledAudio([new Float32Array(48_000)])))
        .gainDb,
    ).toBe(0)
    const quiet = toneAudio(48_000, 1, 0.0005)
    const before = quiet.getChannelData(0).slice()
    expect((await sourcePreparation(quiet)).gainDb).toBe(36)
    expect(quiet.getChannelData(0)).toEqual(before)
    expect((await sourcePreparation(toneAudio(48000, 2, 100))).gainDb).toBe(-24)
  })

  it('cancels between analysis chunks and rejects nonfinite source samples', async () => {
    const abort = new AbortController()
    const pending = measurePreparationLoudness(toneAudio(144000), abort.signal)
    abort.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(
      measurePreparationLoudness(sampledAudio([[NaN]])),
    ).rejects.toThrow('invalid samples')
  })
})
