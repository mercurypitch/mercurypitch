// Studio WAV export — immutable snapshots, capped loudness trials and verified delivered PCM.
import { MASTER_MIN_GAIN_DB } from '@/lib/studio-fx/master'
import { reserveStudioMemory } from '../memory-budget'
import { audioBufferReader, measureStudioPcm } from '../metering/measure-async'
import type { StudioLoudnessMeasurement } from '../metering/stream-meter'
import { STUDIO_TRUE_PEAK_VERSION } from '../metering/true-peak'
import type { StudioAsset, StudioProject } from '../model/types'
import { validateStudioProject } from '../model/validation'
import { renderStudioArrangement } from '../playback/offline-render'
import { encodeStudioWav, STUDIO_WAV_ENCODER_WORKING_BYTES } from './encode-wav'
import { acquireStudioRenderJob } from './render-admission'
import type { StudioRenderedBuffer } from './render-chain'
import { renderStudioChain } from './render-chain'
import { renderStudioTarget } from './render-target'
import { resolveStudioSoundGraph } from './sound-graph'
import type { StudioWavMeasurement } from './wav-measure'
import { measureStudioWav } from './wav-measure'

/** Engineering margin for this finite estimate; not a certified true-peak guarantee. */
export const STUDIO_EXPORT_PEAK_GUARD_DB = 0.75
export type StudioExportStage =
  | 'preparing'
  | 'rendering'
  | 'measuring'
  | 'encoding'
  | 'verifying'
export interface StudioExportToken {
  projectId: string
  revision: number
  engineVersion: string
  meterVersion: string
  audioKey: string
}
export interface StudioWavExport {
  blob: Blob
  token: StudioExportToken
  before: StudioLoudnessMeasurement
  measurement: StudioWavMeasurement
  gainDb: number
  safetyGainDb: number
  /** Hold the immutable Blob reservation until download/share consumers are finished. */
  release(): void
}
export interface StudioExportOptions {
  signal?: AbortSignal
  onStage?: (stage: StudioExportStage) => void
  isCurrent?: (token: StudioExportToken) => boolean
  createContext?: (options: OfflineAudioContextOptions) => OfflineAudioContext
  /** Native render/worker adapters are injectable for focused lifecycle tests. */
  dependencies?: {
    arrangement?: typeof renderStudioArrangement
    chain?: typeof renderStudioChain
    measurePcm?: typeof measureStudioPcm
    measureWav?: typeof measureStudioWav
  }
}

export async function renderStudioWav(
  project: StudioProject,
  assets: readonly StudioAsset[],
  read: (id: string) => Promise<Blob>,
  options: StudioExportOptions = {},
): Promise<StudioWavExport> {
  const releaseJob = acquireStudioRenderJob()
  const signal = options.signal ?? new AbortController().signal
  let arrangement: StudioRenderedBuffer | undefined
  let bus: StudioRenderedBuffer | undefined
  let candidate: StudioRenderedBuffer | undefined
  let releaseBytes: (() => void) | undefined
  let releaseBlob: (() => void) | undefined
  try {
    const owned = structuredClone(assets)
    const snapshot = validateStudioProject(project, owned)
    if (snapshot.export.range !== 'song')
      throw new Error('Choose the whole song for this WAV export.')
    if (snapshot.clips.length === 0)
      throw new Error('Add audio before exporting a song.')
    const token: StudioExportToken = {
      projectId: snapshot.id,
      revision: snapshot.revision,
      engineVersion: snapshot.master.engineVersion,
      meterVersion: STUDIO_TRUE_PEAK_VERSION,
      audioKey: JSON.stringify({
        project: snapshot,
        assets: owned.map((asset) => [
          asset.id,
          asset.canonicalPcmSha256,
          asset.preparation,
        ]),
      }),
    }
    const check = (stage?: StudioExportStage) => {
      signal.throwIfAborted()
      if (options.isCurrent?.(token) === false)
        throw new Error(
          'The song changed while rendering. Export the current version again.',
        )
      if (stage !== undefined) options.onStage?.(stage)
    }
    const chain = options.dependencies?.chain ?? renderStudioChain
    const measurePcm = options.dependencies?.measurePcm ?? measureStudioPcm
    const measureWav = options.dependencies?.measureWav ?? measureStudioWav
    const renderOptions = { signal, createContext: options.createContext }
    check('preparing')
    arrangement = await (
      options.dependencies?.arrangement ?? renderStudioArrangement
    )(snapshot, owned, read, renderOptions)
    check('rendering')
    bus = await chain(
      arrangement.buffer,
      resolveStudioSoundGraph(snapshot).bus,
      renderOptions,
    )
    arrangement.release()
    arrangement = undefined
    check('measuring')
    const before = await measurePcm(audioBufferReader(bus.buffer), { signal })
    const targeted = await renderStudioTarget(bus.buffer, snapshot, before, {
      ...renderOptions,
      check,
      chain,
      measurePcm,
    })
    candidate = targeted.candidate
    const gainDb = targeted.gainDb
    let safetyGainDb = 0
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!candidate) {
        check('rendering')
        candidate = await chain(
          bus.buffer,
          resolveStudioSoundGraph(snapshot, { gainDb, safetyGainDb }).finish,
          renderOptions,
        )
      }
      check('encoding')
      const byteLength = 44 + candidate.buffer.length * 4
      releaseBytes = reserveStudioMemory(
        byteLength + STUDIO_WAV_ENCODER_WORKING_BYTES,
      )
      const bytes = await encodeStudioWav(candidate.buffer, signal)
      const expectedFrames = candidate.buffer.length
      candidate.release()
      candidate = undefined
      check('verifying')
      const measurement = await measureWav(bytes, { signal })
      if (measurement.frames !== expectedFrames)
        throw new Error(
          'The rendered WAV has the wrong duration. Try exporting again.',
        )
      check()
      const excess =
        measurement.truePeakDb -
        (snapshot.master.ceilingDbtp - STUDIO_EXPORT_PEAK_GUARD_DB)
      if (excess <= 0.001 || measurement.truePeakDb === -Infinity) {
        releaseBlob = reserveStudioMemory(bytes.byteLength)
        const blob = new Blob([bytes], { type: 'audio/wav' })
        const result = {
          blob,
          token,
          before,
          measurement,
          gainDb,
          safetyGainDb,
          release: releaseBlob,
        }
        releaseBlob = undefined
        return result
      }
      releaseBytes()
      releaseBytes = undefined
      if (attempt === 2 || safetyGainDb - excess < MASTER_MIN_GAIN_DB)
        throw new Error(
          'The WAV exceeded the export peak limit. Lower the lane levels and try again.',
        )
      safetyGainDb -= excess + 0.01
    }
    throw new Error('The WAV could not be verified. Try exporting again.')
  } finally {
    arrangement?.release()
    bus?.release()
    candidate?.release()
    releaseBytes?.()
    releaseBlob?.()
    releaseJob()
  }
}
