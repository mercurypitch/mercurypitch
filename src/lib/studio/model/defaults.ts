// Studio defaults — explicit local project creation and lane sound without duplicate normalization.
import { roleChain } from '@/lib/studio-fx/auto-mix'
import { defaultEffectParams, updateEffect } from '@/lib/studio-fx/chain-spec'
import { NEUTRAL_MACROS } from '@/lib/studio-fx/mix-macros'
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { ROLE_BALANCE_DB } from '@/lib/studio-fx/role-chains'
import type { StudioProject, StudioProjectSummary, StudioTrack } from './types'
import { STUDIO_ENGINE_VERSION, STUDIO_SAMPLE_RATE, STUDIO_SCHEMA_VERSION, } from './types'
import { validateStudioProject, validateStudioTrack } from './validation'

export function createStudioProject(options: {
  id: string
  title?: string
  now?: Date | string
}): StudioProject {
  const now =
    options.now instanceof Date
      ? options.now.toISOString()
      : (options.now ?? new Date().toISOString())
  return validateStudioProject({
    id: options.id,
    schemaVersion: STUDIO_SCHEMA_VERSION,
    revision: 0,
    title: options.title ?? 'Untitled song',
    createdAt: now,
    updatedAt: now,
    sampleRate: STUDIO_SAMPLE_RATE,
    tempoBpm: 120,
    ruler: 'time',
    tracks: [],
    clips: [],
    mix: { flavourId: 'natural', macros: { ...NEUTRAL_MACROS } },
    master: {
      presetId: 'streaming',
      engineVersion: STUDIO_ENGINE_VERSION,
      targetLufs: -14,
      ceilingDbtp: -1.5,
      maxLimitingDb: 5,
      masterEq: { ...defaultEffectParams('eq'), lowCutHz: 25 },
    },
    export: { format: 'wav', bitDepth: 16, range: 'song' },
  })
}

export function createStudioTrack(options: {
  id: string
  name: string
  order: number
  role?: TrackRole
}): StudioTrack {
  const role = options.role ?? 'other'
  // Preparation is per owned asset; role balance is an explicit lane gain.
  const baseSpec = updateEffect(roleChain(role), 'balance', {
    params: { gainDb: 0 },
  })
  return validateStudioTrack({
    id: options.id,
    name: options.name,
    order: options.order,
    role,
    gainDb: 0,
    balanceGainDb: ROLE_BALANCE_DB[role],
    pan: 0,
    mute: false,
    solo: false,
    fx: { version: 1, baseSpec, spaceOffset: 0 },
  })
}

export function summarizeStudioProject(
  project: StudioProject,
): StudioProjectSummary {
  let durationFrames = 0
  for (const clip of project.clips)
    durationFrames = Math.max(
      durationFrames,
      clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame,
    )
  return {
    id: project.id,
    title: project.title,
    revision: project.revision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    trackCount: project.tracks.length,
    clipCount: project.clips.length,
    durationFrames,
  }
}
