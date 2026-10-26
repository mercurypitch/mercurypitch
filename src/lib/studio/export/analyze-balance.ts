// Studio balance proposal — measure audible lanes before user faders, without changing the project.
import { balanceTrimDb } from '@/lib/studio-fx/auto-mix'
import { audioBufferReader, measureStudioPcm } from '../metering/measure-async'
import type { StudioAsset, StudioProject } from '../model/types'
import { validateStudioProject } from '../model/validation'
import { renderStudioArrangement } from '../playback/offline-render'
import { acquireStudioRenderJob } from './render-admission'

export interface StudioBalanceProposal {
  projectId: string
  revision: number
  balanceGainDbByTrack: Readonly<Record<string, number>>
}
export interface StudioBalanceOptions {
  signal?: AbortSignal
  isCurrent?: (token: { projectId: string; revision: number }) => boolean
  onLane?: (completed: number, total: number) => void
  createContext?: (options: OfflineAudioContextOptions) => OfflineAudioContext
  dependencies?: {
    arrangement?: typeof renderStudioArrangement
    measurePcm?: typeof measureStudioPcm
  }
}

export async function analyzeStudioBalance(
  project: StudioProject,
  assets: readonly StudioAsset[],
  read: (id: string) => Promise<Blob>,
  options: StudioBalanceOptions = {},
): Promise<StudioBalanceProposal> {
  const releaseJob = acquireStudioRenderJob()
  const signal = options.signal ?? new AbortController().signal
  try {
    const owned = structuredClone(assets)
    const snapshot = validateStudioProject(project, owned)
    const token = { projectId: snapshot.id, revision: snapshot.revision }
    const check = () => {
      signal.throwIfAborted()
      if (options.isCurrent?.(token) === false)
        throw new Error(
          'The song changed while balancing. Balance the current version again.',
        )
    }
    const hasSolo = snapshot.tracks.some((track) => track.solo)
    const lanes = snapshot.tracks.filter(
      (track) =>
        !track.mute &&
        (!hasSolo || track.solo) &&
        snapshot.clips.some((clip) => clip.trackId === track.id),
    )
    const gains: Record<string, number> = {}
    for (const [index, track] of lanes.entries()) {
      check()
      options.onLane?.(index, lanes.length)
      const lane: StudioProject = {
        ...snapshot,
        tracks: [
          {
            ...track,
            gainDb: 0,
            balanceGainDb: 0,
            pan: 0,
            mute: false,
            solo: false,
            order: 0,
          },
        ],
        clips: snapshot.clips.filter((clip) => clip.trackId === track.id),
      }
      const rendered = await (
        options.dependencies?.arrangement ?? renderStudioArrangement
      )(lane, owned, read, { signal, createContext: options.createContext })
      try {
        check()
        const measured = await (
          options.dependencies?.measurePcm ?? measureStudioPcm
        )(audioBufferReader(rendered.buffer), { signal, truePeak: false })
        check()
        gains[track.id] = balanceTrimDb(track.role, measured.integratedLufs)
      } finally {
        rendered.release()
      }
    }
    check()
    options.onLane?.(lanes.length, lanes.length)
    return { ...token, balanceGainDbByTrack: gains }
  } finally {
    releaseJob()
  }
}
