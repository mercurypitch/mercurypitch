// Export lifecycle regressions cover final bytes, capped correction, stale work and native cancellation.
import { describe, expect, it, vi } from 'vitest'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { FakeBuffer } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { reserveStudioMemory, studioReservedMemoryBytes, } from '../memory-budget'
import { measureStudioPcm } from '../metering/measure-async'
import { meterTone } from '../metering/meter.test-fixtures'
import { studioFixture } from '../model/model.test-fixtures'
import type { renderStudioArrangement } from '../playback/offline-render'
import { PlaybackContext } from '../playback/playback.test-fixtures'
import { analyzeStudioBalance } from './analyze-balance'
import { prepareStudioComparison } from './prepare-comparison'
import type { StudioRenderedBuffer } from './render-chain'
import { renderStudioChain } from './render-chain'
import { renderStudioWav, STUDIO_EXPORT_PEAK_GUARD_DB } from './render-wav'
import { measureStudioWav } from './wav-measure'

function audio(samples: Float32Array): AudioBuffer {
  return {
    numberOfChannels: 2,
    sampleRate: 48000,
    length: samples.length,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

function owned(buffer: AudioBuffer): StudioRenderedBuffer {
  return { buffer, release: reserveStudioMemory(buffer.length * 8) }
}

function testAdapters() {
  const data = meterTone(48000, 0.5, 997, 0.1)
  const arrangement = vi.fn<typeof renderStudioArrangement>(async () => ({
    ...owned(audio(data)),
    projectId: 'project-1',
    revision: 0,
  }))
  // This test adapter models gain/ceiling ownership only; real DSP parity belongs to browser probes.
  const chain = vi.fn<typeof renderStudioChain>(
    async (input: AudioBuffer, spec: ChainSpec) => {
      let gain = 1
      const output = input.getChannelData(0).slice()
      for (const effect of spec.effects) {
        if (effect.kind === 'gain') {
          gain = Math.pow(10, effect.params.gainDb / 20)
          for (let frame = 0; frame < output.length; frame++)
            output[frame] *= gain
        } else if (effect.kind === 'limiter') {
          const ceiling = Math.pow(10, effect.params.ceilingDb / 20)
          for (let frame = 0; frame < output.length; frame++)
            output[frame] = Math.max(-ceiling, Math.min(ceiling, output[frame]))
        }
      }
      return owned(audio(output))
    },
  )
  return {
    arrangement,
    chain,
    measurePcm: ((reader, options) =>
      measureStudioPcm(reader, {
        ...options,
        createWorker: null,
      })) as typeof measureStudioPcm,
    measureWav: ((bytes, options) =>
      measureStudioWav(bytes, {
        ...options,
        createWorker: null,
      })) as typeof measureStudioWav,
  }
}

describe('Studio verified WAV job', () => {
  it('proposes role balance before user faders and preserves the source arrangement', async () => {
    const { project, asset } = studioFixture()
    const original = {
      ...project,
      tracks: project.tracks.map((track) => ({
        ...track,
        gainDb: -9,
        balanceGainDb: 4,
        pan: 0.8,
      })),
    }
    const adapters = testAdapters()
    const proposal = await analyzeStudioBalance(original, [asset], vi.fn(), {
      dependencies: adapters,
    })
    const measuredLane = adapters.arrangement.mock.calls[0][0].tracks[0]
    expect(measuredLane).toMatchObject({ gainDb: 0, balanceGainDb: 0, pan: 0 })
    expect(original.tracks[0]).toMatchObject({
      gainDb: -9,
      balanceGainDb: 4,
      pan: 0.8,
    })
    expect(proposal.projectId).toBe(original.id)
    expect(proposal.revision).toBe(original.revision)
    expect(Number.isFinite(proposal.balanceGainDbByTrack['track-1'])).toBe(true)
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('prepares two retained WAVs with attenuation-only level matching and no source mutation', async () => {
    const { project, asset } = studioFixture()
    const original = structuredClone(project)
    const adapters = testAdapters()
    const result = await prepareStudioComparison(project, [asset], vi.fn(), {
      dependencies: adapters,
    })
    const before = await measureStudioWav(await result.before.arrayBuffer(), {
      createWorker: null,
    })
    const after = await measureStudioWav(await result.after.arrayBuffer(), {
      createWorker: null,
    })
    expect(before.integratedLufs + result.beforeGainDb).toBeCloseTo(
      after.integratedLufs + result.afterGainDb,
      8,
    )
    expect(result.beforeGainDb).toBeLessThanOrEqual(0)
    expect(result.afterGainDb).toBeLessThanOrEqual(0)
    expect(result.durationSeconds).toBe(before.frames / 48000)
    expect(
      adapters.arrangement.mock.calls[1][0].tracks[0].fx.baseSpec.effects.every(
        (effect) => effect.enabled === false,
      ),
    ).toBe(true)
    expect(project).toEqual(original)
    expect(studioReservedMemoryBytes()).toBe(
      result.before.size + result.after.size,
    )
    result.release()
    result.release()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('delivers exactly the measured 16-bit file and keeps only its result lease', async () => {
    const { project, asset } = studioFixture()
    const result = await renderStudioWav(project, [asset], vi.fn(), {
      dependencies: testAdapters(),
    })
    const measured = await measureStudioWav(await result.blob.arrayBuffer(), {
      createWorker: null,
    })
    expect(result.measurement).toEqual(measured)
    expect(measured.truePeakDb).toBeLessThanOrEqual(
      project.master.ceilingDbtp - STUDIO_EXPORT_PEAK_GUARD_DB + 0.001,
    )
    expect(result.token).toMatchObject({
      projectId: project.id,
      revision: project.revision,
    })
    expect(studioReservedMemoryBytes()).toBe(result.blob.size)
    result.release()
    result.release()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('corrects final-file overs monotonically without topping the target gain back up', async () => {
    const { project, asset } = studioFixture()
    const adapters = testAdapters()
    const measurePcm = vi.fn(async () => ({
      integratedLufs: project.master.targetLufs,
      samplePeakDb: -6,
      truePeakDb: -6,
    }))
    const measureWav = vi
      .fn()
      .mockResolvedValueOnce({
        frames: 24000,
        channels: 2,
        sampleRate: 48000,
        bitDepth: 16,
        integratedLufs: -14,
        samplePeakDb: -1.5,
        truePeakDb: 0,
      })
      .mockResolvedValueOnce({
        frames: 24000,
        channels: 2,
        sampleRate: 48000,
        bitDepth: 16,
        integratedLufs: -17,
        samplePeakDb: -4.5,
        truePeakDb: -3,
      })
    const result = await renderStudioWav(project, [asset], vi.fn(), {
      dependencies: { ...adapters, measurePcm, measureWav },
    })
    const finishSpecs = adapters.chain.mock.calls
      .map((call) => call[1])
      .filter((spec) => spec.effects.some((effect) => effect.id === 'ceiling'))
    expect(finishSpecs).toHaveLength(2)
    expect(
      finishSpecs.map(
        (spec) =>
          spec.effects.find((effect) => effect.id === 'loudness')?.params
            .gainDb,
      ),
    ).toEqual([0, 0])
    expect(result.safetyGainDb).toBeLessThan(-2.25)
    expect(result.gainDb).toBe(0)
    result.release()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('keeps exclusive admission until an aborted native stage settles', async () => {
    const { project, asset } = studioFixture()
    const controller = new AbortController()
    let finish!: (
      value: StudioRenderedBuffer & { projectId: string; revision: number },
    ) => void
    const rendered = owned(audio(new Float32Array(100)))
    const arrangement = vi.fn(
      () =>
        new Promise<
          StudioRenderedBuffer & { projectId: string; revision: number }
        >((resolve) => {
          finish = resolve
        }),
    )
    const pending = renderStudioWav(project, [asset], vi.fn(), {
      signal: controller.signal,
      dependencies: { arrangement },
    })
    controller.abort()
    await expect(renderStudioWav(project, [asset], vi.fn())).rejects.toThrow(
      'still rendering',
    )
    expect(studioReservedMemoryBytes()).toBe(800)
    finish({ ...rendered, projectId: project.id, revision: project.revision })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('freezes the snapshot and rejects a stale result before offering its bytes', async () => {
    const { project, asset } = studioFixture()
    let current = true
    const adapters = testAdapters()
    adapters.arrangement.mockImplementationOnce(async () => {
      Object.assign(project, { title: 'New name' })
      current = false
      return {
        ...owned(audio(new Float32Array(10))),
        projectId: project.id,
        revision: project.revision,
      }
    })
    await expect(
      renderStudioWav(project, [asset], vi.fn(), {
        isCurrent: () => current,
        dependencies: adapters,
      }),
    ).rejects.toThrow('song changed')
    expect(adapters.arrangement.mock.calls[0][0].title).toBe('First song')
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('stops after the bounded correction attempts and releases every result', async () => {
    const { project, asset } = studioFixture()
    const adapters = testAdapters()
    const measurePcm = vi.fn(async () => ({
      integratedLufs: project.master.targetLufs,
      samplePeakDb: -6,
      truePeakDb: -6,
    }))
    const measureWav = vi.fn(async () => ({
      frames: 24000,
      channels: 2 as const,
      sampleRate: 48000 as const,
      bitDepth: 16 as const,
      integratedLufs: -14,
      samplePeakDb: -1.5,
      truePeakDb: 0,
    }))
    await expect(
      renderStudioWav(project, [asset], vi.fn(), {
        dependencies: { ...adapters, measurePcm, measureWav },
      }),
    ).rejects.toThrow('peak limit')
    expect(measureWav).toHaveBeenCalledTimes(3)
    expect(studioReservedMemoryBytes()).toBe(0)
  })
})

it('an aborted latency probe settles its admission but never starts a full native render', async () => {
  let settle!: (buffer: AudioBuffer) => void
  let count = 0
  const calls: number[] = []
  const createContext = (options: OfflineAudioContextOptions) => {
    const ctx = new PlaybackContext()
    ctx.state = 'suspended'
    const ordinal = ++count
    Object.assign(ctx, {
      startRendering: () => {
        calls.push(ordinal)
        if (ordinal === 2)
          return new Promise<AudioBuffer>((resolve) => {
            settle = resolve
          })
        return Promise.resolve(new FakeBuffer(2, options.length, 48000))
      },
    })
    return ctx as unknown as OfflineAudioContext
  }
  const abort = new AbortController()
  const spec = normalizeChainSpec({
    effects: [{ kind: 'gain', params: { gainDb: 0 } }],
  })
  const pending = renderStudioChain(
    new FakeBuffer(2, 48000, 48000) as unknown as AudioBuffer,
    spec,
    { signal: abort.signal, createContext },
  )
  expect(calls).toEqual([2])
  const held = studioReservedMemoryBytes()
  expect(held).toBeGreaterThan(0)
  abort.abort()
  expect(studioReservedMemoryBytes()).toBe(held)
  settle(new FakeBuffer(2, 32192, 48000) as unknown as AudioBuffer)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls).toEqual([2])
  expect(studioReservedMemoryBytes()).toBe(0)
})
