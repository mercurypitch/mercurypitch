// Studio render test adapters — an arrangement, chain and meters that model gain ownership, not DSP, for export, Compare and balance tests.
import { vi } from 'vitest'
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { reserveStudioMemory } from '../memory-budget'
import { measureStudioPcm } from '../metering/measure-async'
import { meterTone } from '../metering/meter.test-fixtures'
import type { renderStudioArrangement } from '../playback/offline-render'
import type { renderStudioChain, StudioRenderedBuffer } from './render-chain'
import { measureStudioWav } from './wav-measure'

export function audio(samples: Float32Array): AudioBuffer {
  return {
    numberOfChannels: 2,
    sampleRate: 48000,
    length: samples.length,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

export function owned(buffer: AudioBuffer): StudioRenderedBuffer {
  return { buffer, release: reserveStudioMemory(buffer.length * 8) }
}

export function testAdapters() {
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
