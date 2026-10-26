// Studio target render — at most three gain trials from the same bus within the original limiting cap.
import { MASTER_MAX_GAIN_DB, MASTER_MIN_GAIN_DB, masterGainDb, } from '@/lib/studio-fx/master'
import type { measureStudioPcm } from '../metering/measure-async'
import { audioBufferReader } from '../metering/measure-async'
import type { StudioLoudnessMeasurement } from '../metering/stream-meter'
import type { StudioProject } from '../model/types'
import type { renderStudioChain, StudioChainRenderOptions, StudioRenderedBuffer, } from './render-chain'
import { resolveStudioSoundGraph } from './sound-graph'

export async function renderStudioTarget(
  bus: AudioBuffer,
  snapshot: StudioProject,
  before: StudioLoudnessMeasurement,
  options: StudioChainRenderOptions & {
    check(stage: 'rendering' | 'measuring'): void
    chain: typeof renderStudioChain
    measurePcm: typeof measureStudioPcm
  },
): Promise<{ candidate: StudioRenderedBuffer; gainDb: number }> {
  const settings = {
    targetLufs: snapshot.master.targetLufs,
    ceilingDb: snapshot.master.ceilingDbtp,
    maxLimitingDb: snapshot.master.maxLimitingDb,
  }
  const cap = Math.min(
    MASTER_MAX_GAIN_DB,
    settings.ceilingDb + settings.maxLimitingDb - before.truePeakDb,
  )
  if (Number.isFinite(cap) && cap < MASTER_MIN_GAIN_DB)
    throw new Error(
      'The song is too loud for this mastering setting. Lower the lane levels and export again.',
    )
  let gainDb = masterGainDb(before, settings)
  let candidate: StudioRenderedBuffer | undefined
  try {
    for (let pass = 0; pass < 3; pass++) {
      options.check('rendering')
      candidate = await options.chain(
        bus,
        resolveStudioSoundGraph(snapshot, { gainDb, safetyGainDb: 0 }).finish,
        options,
      )
      options.check('measuring')
      const measurement = await options.measurePcm(
        audioBufferReader(candidate.buffer),
        { signal: options.signal, truePeak: false },
      )
      const difference = settings.targetLufs - measurement.integratedLufs
      if (
        !Number.isFinite(difference) ||
        Math.abs(difference) <= 0.2 ||
        pass === 2
      )
        break
      const next = Math.max(
        MASTER_MIN_GAIN_DB,
        Math.min(cap, gainDb + difference),
      )
      if (Math.abs(next - gainDb) < 0.05) break
      candidate.release()
      candidate = undefined
      gainDb = next
    }
    if (!candidate) throw new Error('The mastering pass did not return audio.')
    const result = { candidate, gainDb }
    candidate = undefined
    return result
  } finally {
    candidate?.release()
  }
}
