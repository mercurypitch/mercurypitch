// Studio admitted chain render — hold native output reservations until the uncancellable pass settles.
import type { ChainSpec } from '@/lib/studio-fx/chain-spec'
import { renderThroughChain } from '@/lib/studio-fx/render'
import { reserveStudioMemory } from '../memory-budget'

export interface StudioRenderedBuffer {
  buffer: AudioBuffer
  release(): void
}
export interface StudioChainRenderOptions {
  signal: AbortSignal
  createContext?: (options: OfflineAudioContextOptions) => OfflineAudioContext
}

export async function renderStudioChain(
  source: AudioBuffer,
  spec: ChainSpec,
  options: StudioChainRenderOptions,
): Promise<StudioRenderedBuffer> {
  options.signal.throwIfAborted()
  // Current master/finish chains have no delay/reverb tail. This reserves native render,
  // warmup/latency probe, copied result and a conservative allowance for their effect nodes.
  const resultBytes = source.length * 2 * 4
  const releaseWorking = reserveStudioMemory(
    (source.length + Math.ceil(source.sampleRate * 0.5) + 8192) * 2 * 4 +
      2 * 1024 * 1024,
  )
  let releaseResult: (() => void) | undefined
  try {
    releaseResult = reserveStudioMemory(resultBytes)
    const buffer = await renderThroughChain(source, spec, {
      signal: options.signal,
      tailSeconds: 0,
      createContext: options.createContext,
    })
    options.signal.throwIfAborted()
    const result = { buffer, release: releaseResult }
    releaseResult = undefined
    return result
  } finally {
    releaseWorking()
    releaseResult?.()
  }
}
