// Studio comparison — mastered After and dry Before renders, matched only by attenuation.
import { reserveStudioMemory } from '../memory-budget'
import { audioBufferReader, measureStudioPcm } from '../metering/measure-async'
import type { StudioAsset, StudioProject } from '../model/types'
import { validateStudioProject } from '../model/validation'
import { renderStudioArrangement } from '../playback/offline-render'
import { encodeStudioWav, STUDIO_WAV_ENCODER_WORKING_BYTES } from './encode-wav'
import { acquireStudioRenderJob } from './render-admission'
import type { StudioRenderedBuffer } from './render-chain'
import type { StudioExportOptions, StudioWavExport } from './render-wav'
import { renderStudioWav } from './render-wav'
import { measureStudioWav } from './wav-measure'

export interface StudioComparison {
  projectId: string
  revision: number
  before: Blob
  after: Blob
  beforeGainDb: number
  afterGainDb: number
  gainDb: number
  safetyGainDb: number
  durationSeconds: number
  release(): void
}

export async function prepareStudioComparison(
  project: StudioProject,
  assets: readonly StudioAsset[],
  read: (id: string) => Promise<Blob>,
  options: StudioExportOptions = {},
): Promise<StudioComparison> {
  const snapshot = validateStudioProject(project, assets)
  const owned = structuredClone(assets)
  const signal = options.signal ?? new AbortController().signal
  let after: StudioWavExport | undefined
  let dry: StudioRenderedBuffer | undefined
  let releaseJob: (() => void) | undefined
  let releaseBytes: (() => void) | undefined
  let releaseBlob: (() => void) | undefined
  try {
    after = await renderStudioWav(snapshot, owned, read, { ...options, signal })
    releaseJob = acquireStudioRenderJob()
    const check = () => {
      signal.throwIfAborted()
      if (options.isCurrent?.(after!.token) === false)
        throw new Error('The song changed. Prepare Compare again.')
    }
    check()
    const original: StudioProject = {
      ...snapshot,
      tracks: snapshot.tracks.map((track) => ({
        ...track,
        fx: {
          ...track.fx,
          baseSpec: {
            ...track.fx.baseSpec,
            effects: track.fx.baseSpec.effects.map((effect) => ({
              ...effect,
              enabled: false,
            })),
          },
        },
      })),
    }
    options.onStage?.('rendering')
    dry = await (options.dependencies?.arrangement ?? renderStudioArrangement)(
      original,
      owned,
      read,
      { signal, createContext: options.createContext },
    )
    check()
    options.onStage?.('measuring')
    const measured = await (
      options.dependencies?.measurePcm ?? measureStudioPcm
    )(audioBufferReader(dry.buffer), { signal })
    const encodingGain = Math.min(0, -3 - measured.truePeakDb)
    if (
      !Number.isFinite(measured.integratedLufs) ||
      !Number.isFinite(after.measurement.integratedLufs)
    )
      throw new Error('Compare needs audible audio on both sides.')
    const frames = Math.max(dry.buffer.length, after.measurement.frames)
    releaseBytes = reserveStudioMemory(
      44 + frames * 4 + STUDIO_WAV_ENCODER_WORKING_BYTES,
    )
    options.onStage?.('encoding')
    const bytes = await encodeStudioWav(dry.buffer, signal, {
      gainDb: encodingGain,
      frames,
    })
    dry.release()
    dry = undefined
    const beforeMeasurement = await (
      options.dependencies?.measureWav ?? measureStudioWav
    )(bytes, { signal, truePeak: false })
    check()
    if (!Number.isFinite(beforeMeasurement.integratedLufs))
      throw new Error('The original is too quiet for a useful comparison.')
    const match = Math.min(
      beforeMeasurement.integratedLufs,
      after.measurement.integratedLufs,
    )
    releaseBlob = reserveStudioMemory(bytes.byteLength)
    const before = new Blob([bytes], { type: 'audio/wav' })
    const retainedAfter = after
    const retainedBefore = releaseBlob
    const result = {
      projectId: snapshot.id,
      revision: snapshot.revision,
      before,
      after: after.blob,
      beforeGainDb: match - beforeMeasurement.integratedLufs,
      afterGainDb: match - after.measurement.integratedLufs,
      gainDb: after.gainDb,
      safetyGainDb: after.safetyGainDb,
      durationSeconds: frames / 48000,
      release() {
        retainedAfter.release()
        retainedBefore()
      },
    }
    after = undefined
    releaseBlob = undefined
    return result
  } finally {
    after?.release()
    dry?.release()
    releaseBytes?.()
    releaseBlob?.()
    releaseJob?.()
  }
}
